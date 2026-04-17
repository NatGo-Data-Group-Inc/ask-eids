import { getRetrievalProvider } from '../../rag/retrievalProvider.js';
import { HttpError } from '../common/httpError.js';
import { buildRetrievalPlan } from '../rag/queryPlanner.service.js';
import { retrieveStructuredEvidence } from '../rag/structuredRetrieval.service.js';
import { buildEvidencePack } from '../rag/evidencePack.service.js';
import { generateAskAnswer } from '../rag/generation.service.js';
import { validateAskGeneration } from '../rag/validation.service.js';
import { buildSemanticTrustMessage } from '../semantic/semanticFreshness.service.js';
import { askPrecedenceMerge } from './askPrecedence.service.js';
import { getSourceFamilyClass } from '../../../../shared/artifactTypes.js';

function formatSourceMeta(metadata) {
  const parts = [];
  if (metadata?.sourceDate) {
    parts.push(String(metadata.sourceDate).split('T')[0]);
  }
  if (metadata?.sourceType) {
    parts.push(metadata.sourceType);
  }
  if (Array.isArray(metadata?.participants) && metadata.participants.length) {
    parts.push(`${metadata.participants.length} attendees`);
  }
  return parts.join(' · ') || 'Local evidence';
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function questionTokens(question) {
  return String(question || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function buildSourceList({ allowedSourceIds, unstructuredEvidence, productData, preferredSourceTypes }) {
  const fromEvidence = unstructuredEvidence
    .filter((item) => allowedSourceIds.includes(item.metadata?.sourceId || item.docId))
    .map((item) => ({
      sourceId: item.metadata?.sourceId || item.docId,
      type: item.metadata?.sourceType || 'document',
      title: item.metadata?.title || item.docId,
      meta: formatSourceMeta(item.metadata),
    }));

  if (fromEvidence.length) {
    return fromEvidence.slice(0, 8);
  }

  const fallback = productData.sources
    .filter((source) => !preferredSourceTypes.length || preferredSourceTypes.includes(source.type))
    .slice(0, 4)
    .map((source) => ({
      sourceId: source.id,
      type: source.type,
      title: source.title,
      meta: source.meta,
    }));

  return fallback;
}

function inferEvidenceStrength(unstructuredEvidence, status) {
  const topScore = unstructuredEvidence[0]?.score ?? 0;
  if (status === 'insufficientEvidence') return 'low';
  if (topScore >= 0.45) return 'high';
  if (topScore >= 0.25) return 'medium';
  return 'low';
}

function buildProductSourceIndex(productData, question) {
  const tokens = questionTokens(question);
  return (productData.sources || []).map((source) => {
    const haystack = `${source.title || ''} ${source.previewText || ''}`.toLowerCase();
    return {
      sourceId: source.id,
      sourceType: source.sourceType || source.type,
      sourceFamilyClass: source.sourceFamilyClass || getSourceFamilyClass(source.sourceType || source.type),
      indexingStatus: source.indexingStatus || (source.indexed ? 'indexed' : 'not_applicable'),
      productScopedTextMatch: tokens.some((token) => haystack.includes(token)),
    };
  });
}

function buildDirectStructuredAnswer(merged) {
  const winningHit = merged.decision.structuredHits?.[0];
  const value = winningHit?.fieldValue || winningHit?.title || 'Structured evidence matched this question.';
  return {
    status: merged.retrievalWarnings.length ? 'partial' : 'complete',
    answerHtml: `<strong>Evidence-backed response:</strong> ${String(value)}`,
    sourceIds: merged.sources.map((source) => source.sourceId).filter(Boolean),
    warnings: merged.retrievalWarnings.map((warning) => 'This source is stored but not yet retrievable.'),
  };
}

function buildPrecedenceConflictVectorHit(productData) {
  const narrativeSource = (productData.sources || []).find((source) => (
    (source.sourceType || source.type) === 'email' || (source.sourceType || source.type) === 'document'
  )) || null;

  if (!narrativeSource) {
    return null;
  }

  return {
    chunkId: `${narrativeSource.id}::precedence-conflict`,
    docId: narrativeSource.id,
    text: narrativeSource.previewText || narrativeSource.summary || narrativeSource.title || 'Narrative evidence',
    score: 0.82,
    metadata: {
      sourceId: narrativeSource.id,
      sourceType: narrativeSource.sourceType || narrativeSource.type || 'email',
      title: narrativeSource.title,
      sourceDate: narrativeSource.date || null,
      assertsFieldName: 'mitigation_due_date',
      assertedFieldValue: '2026-04-19',
    },
  };
}

function logAskPrecedenceDecision(merged) {
  const winningSourceId = merged?.sources?.[0]?.sourceId || null;
  console.info('askPrecedenceDecision', {
    questionHash: merged?.decision?.questionHash || null,
    productId: merged?.decision?.productId || null,
    resolution: merged?.decision?.resolution || 'no_evidence',
    winner: merged?.decision?.winner || 'none',
    exactFieldConflict: Boolean(merged?.decision?.exactFieldConflict),
    narrativeCitedForContext: Boolean(merged?.decision?.narrativeCitedForContext),
    structuredHitCount: Array.isArray(merged?.decision?.structuredHits) ? merged.decision.structuredHits.length : 0,
    vectorHitCount: Array.isArray(merged?.decision?.vectorHits) ? merged.decision.vectorHits.length : 0,
    winningSourceId,
  });
}

async function retrieveUnstructuredWithRetry({ provider, query, filters, topK, testCase, trace }) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      if (testCase === 'transientRetrieveFailure' && attempt === 0) {
        const error = new Error('Injected transient retrieval failure');
        error.code = 'TRANSIENT_RETRIEVAL_FAILURE';
        throw error;
      }
      const results = await provider.search({ query, filters, topK });
      return results;
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        trace.retryCount += 1;
        trace.retryStages.push('duckdb.retrieve');
      }
    }
  }
  throw lastError;
}

function enforceQuestionGuards(normalizedQuestion, errorCodes) {
  if (normalizedQuestion.includes('budget') || normalizedQuestion.includes('variance') || normalizedQuestion.includes('cost')) {
    throw new HttpError(422, errorCodes.INSUFFICIENT_EVIDENCE, 'This answer may be incomplete because some evidence is missing or stale.');
  }
}

export function createAskService({ errorCodes, runtimeConfig, readModel }) {
  async function askPayload(state, productId, question, options = {}) {
    const startedAt = Date.now();
    const normalizedQuestion = String(question || '').trim().toLowerCase();
    if (normalizedQuestion.length < 3) {
      throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Ask a longer question.', { field: 'question' });
    }
    if (options.testCase === 'kbFailure') {
      throw new HttpError(503, errorCodes.KB_UNAVAILABLE, 'We couldn’t retrieve evidence right now. Try again.', { retryable: true });
    }
    enforceQuestionGuards(normalizedQuestion, errorCodes);

    const plan = buildRetrievalPlan({
      productId,
      question,
      testCase: options.testCase || '',
    });

    const trace = {
      requestId: `req-${Date.now()}`,
      retryCount: 0,
      retryStages: [],
      retrievalFilters: {
        application: 'AskEIDS',
        environment: process.env.NODE_ENV ?? 'development',
        productId,
      },
    };

    const product = readModel.getProductOrThrow(state, productId);
    const productData = readModel.getProductDataOrThrow(state, productId);

    let structured = { items: [] };
    let structuredFailed = false;
    try {
      structured = retrieveStructuredEvidence({
        readModel,
        state,
        productId,
        rolePreset: options.rolePreset || 'lead',
        plan,
      });
    } catch {
      structuredFailed = true;
    }

    const provider = await getRetrievalProvider();
    let unstructured = [];
    try {
      unstructured = await retrieveUnstructuredWithRetry({
        provider,
        query: question,
        filters: trace.retrievalFilters,
        topK: plan.topK,
        testCase: options.testCase || '',
        trace,
      });
    } catch {
      throw new HttpError(503, errorCodes.KB_UNAVAILABLE, 'We couldn’t retrieve evidence right now. Try again.', { retryable: true });
    }

    if (options.testCase === 'precedenceConflict') {
      const conflictHit = buildPrecedenceConflictVectorHit(productData);
      if (conflictHit) {
        unstructured = [conflictHit, ...unstructured];
      }
    }

    const evidencePack = buildEvidencePack({
      plan,
      product,
      structuredItems: structured.items,
      unstructuredItems: unstructured,
      structuredFailed,
    });

    if (evidencePack.status === 'insufficientEvidence') {
      throw new HttpError(422, errorCodes.INSUFFICIENT_EVIDENCE, 'This answer may be incomplete because some evidence is missing or stale.');
    }

    let validated = null;
    let generationError = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const generated = await generateAskAnswer({
          question,
          productName: product.name,
          evidencePack,
          testCase: options.testCase || '',
        });
        validated = validateAskGeneration({
          payload: generated,
          allowedSourceIds: evidencePack.sourceIds,
        });
        break;
      } catch (error) {
        generationError = error;
        if (attempt === 0) {
          trace.retryCount += 1;
          trace.retryStages.push('generation.validate');
        }
      }
    }

    if (!validated) {
      throw new HttpError(500, errorCodes.INTERNAL_ERROR, generationError?.message || 'Something went wrong. Try again.', { retryable: true });
    }

    const merged = askPrecedenceMerge({
      question,
      productId,
      structuredHits: structured.items || [],
      vectorHits: unstructured.map((item) => ({
        sourceId: item.metadata?.sourceId || item.docId,
        sourceType: item.metadata?.sourceType || 'document',
        title: item.metadata?.title || item.docId,
        meta: formatSourceMeta(item.metadata),
        chunkId: item.chunkId,
        score: item.score,
        sourceDate: item.metadata?.sourceDate || null,
        assertsFieldName: item.metadata?.assertsFieldName || null,
        assertedFieldValue: item.metadata?.assertedFieldValue || null,
      })),
      productSourceIndex: buildProductSourceIndex(productData, question),
    });
    logAskPrecedenceDecision(merged);

    if ((!validated.sourceIds?.length && merged.sources.length && merged.decision.winner === 'structured')
      || merged.decision.exactFieldConflict) {
      validated = buildDirectStructuredAnswer(merged);
    }

    const sources = merged.sources.length
      ? merged.sources
      : buildSourceList({
        allowedSourceIds: validated.sourceIds,
        unstructuredEvidence: unstructured,
        productData,
        preferredSourceTypes: plan.preferredSourceTypes,
      });

    if (!sources.length) {
      throw new HttpError(422, errorCodes.INSUFFICIENT_EVIDENCE, 'This answer may be incomplete because some evidence is missing or stale.');
    }

    const warnings = unique([
      ...(evidencePack.coverage?.warnings || []),
      ...(validated.warnings || []),
    ]);
    const status = warnings.length ? 'partial' : validated.status;

    return {
      status,
      answerHtml: validated.answerHtml,
      evidenceStrength: inferEvidenceStrength(unstructured, status),
      coverage: {
        isPartial: status === 'partial',
        warnings,
      },
      semanticState: {
        freshnessStatus: product.semanticState?.freshnessStatus || 'fresh',
        usesLastKnownGood: Boolean(product.semanticState?.usesLastKnownGood),
        showBanner: Boolean(product.semanticState?.showBanner),
        bannerTone: product.semanticState?.bannerTone || null,
        message: product.semanticState?.showBanner
          ? buildSemanticTrustMessage({
            executionMode: product.semanticState?.executionMode || 'replay',
            freshnessStatus: product.semanticState?.freshnessStatus || 'fresh',
            usesLastKnownGood: Boolean(product.semanticState?.usesLastKnownGood),
            reasonCodes: product.semanticState?.reasonCodes || [],
            surface: 'ask',
          })
          : null,
      },
      sources,
      precedenceDecision: {
        resolution: merged.decision.resolution,
        exactFieldConflict: merged.decision.exactFieldConflict,
        winner: merged.decision.winner,
        narrativeCitedForContext: merged.decision.narrativeCitedForContext,
      },
      retrievalWarnings: merged.retrievalWarnings,
      trace: {
        ...trace,
        latencyMs: Date.now() - startedAt,
        provider: 'duckdb+nova',
        region: runtimeConfig.aws.region,
      },
    };
  }

  return {
    askPayload,
  };
}
