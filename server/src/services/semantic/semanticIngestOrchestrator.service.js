import { normalizeSourceArtifact } from './sourceNormalization.service.js';
import { extractSourceWithNova } from './novaSourceExtraction.service.js';
import { projectExtractionCitations } from './citationProjection.service.js';
import { runChunkingAndIndexing } from './chunkingAndIndexing.service.js';
import { getSourceFamilyClass, isStructuredImportType } from '../../../../shared/artifactTypes.js';
import { parseStructuredImportRows } from '../ingest/artifactUpload.service.js';

const FALLBACK_CITATION_MESSAGE = 'Exact coordinates were unavailable for this source. Showing the best available reference.';

function buildStructuredSyntheticExtraction({ normalized, sourceType, executionDecision, runtimeConfig }) {
  const rows = parseStructuredImportRows({ sourceType, text: normalized.normalizedText }) || [];
  const rowCount = rows.length;
  const summary = `Imported ${rowCount} ${sourceType.replace('_export', '')} row${rowCount === 1 ? '' : 's'} from ${normalized.title || sourceType}. Structured data was applied to the corresponding product dataset without narrative extraction.`;
  return {
    extraction: {
      sourceId: normalized.sourceId,
      productId: normalized.productId,
      sourceType,
      summary,
      decisions: [],
      warnings: [],
      confidence: rowCount > 0 ? 'high' : 'low',
    },
    promptRun: {
      runId: `structured-stub-${normalized.sourceId}-${Date.now()}`,
      runRole: 'source_extraction',
      scope: 'source_extraction',
      targetId: normalized.sourceId,
      mode: executionDecision?.executionMode || 'structured_stub',
      modelId: runtimeConfig?.bedrock?.textModelId || null,
      promptVersion: executionDecision?.promptVersion || 'structured-stub-v1',
      latencyMs: 0,
      status: 'succeeded',
      errorJson: null,
      rawPayloadRef: null,
      provider: 'structured_stub',
      providerRequestId: null,
      sourceFamily: executionDecision?.sourceFamily || 'spreadsheet',
      replayKey: null,
      cacheHit: false,
      citationMode: 'structured_rows',
      createdAt: new Date().toISOString(),
    },
  };
}

export async function runSemanticIngest({
  artifactStore,
  normalizedArtifactKey,
  file,
  sourceType,
  sourceId,
  productId,
  title,
  sourceDate,
  author,
  participants = [],
  executionDecision,
  runtimeConfig,
  testCase = '',
  featureFlags,
} = {}) {
  const normalized = await normalizeSourceArtifact({
    file,
    sourceType,
    sourceId,
    productId,
    title,
    sourceDate,
    testCase,
  });

  await artifactStore.writeTextArtifact({
    bucketType: 'normalized',
    key: normalizedArtifactKey,
    content: normalized.normalizedText,
    contentType: 'text/plain; charset=utf-8',
  });

  // Structured imports (CSV-backed risk/blocker/pi/action exports) bypass Nova
  // extraction because the "value" of the source is the structured rows themselves
  // (applied downstream in mutation.service.js). A synthetic extraction record keeps
  // the aggregate input shape consistent.
  const { extraction, promptRun } = isStructuredImportType(sourceType)
    ? buildStructuredSyntheticExtraction({ normalized, sourceType, executionDecision, runtimeConfig })
    : await extractSourceWithNova({
      normalized,
      executionDecision,
      runtimeConfig,
      testCase,
    });

  const sourceFamilyClass = getSourceFamilyClass(sourceType);
  const citationProjection = projectExtractionCitations({
    extraction,
    normalized,
    sourceType,
  });

  const warningText = citationProjection.citationMode === 'exact'
    ? null
    : FALLBACK_CITATION_MESSAGE;
  const warnings = [
    ...(Array.isArray(extraction.warnings) ? extraction.warnings : []),
    ...(warningText ? [warningText] : []),
  ];
  let indexingResult;
  try {
    indexingResult = await runChunkingAndIndexing({
      runtimeConfig,
      productId,
      sourceId,
      sourceType,
      sourceFamilyClass,
      sourceDate,
      title,
      author,
      participants: normalized.participants.length ? normalized.participants : participants,
      normalizedText: normalized.normalizedText,
      featureFlags,
      testCase,
    });
  } catch (error) {
    if (!['EMBEDDING_UNAVAILABLE', 'INDEXING_FAILED'].includes(error?.code)) {
      throw error;
    }
    indexingResult = {
      indexingStatus: 'failed',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
      chunks: [],
      failureReason: error.code,
    };
  }

  return {
    normalized,
    extraction,
    promptRun,
    sourceFamilyClass,
    citationProjection,
    warningText,
    warnings,
    indexingResult,
    updatedDomains: ['sources', 'ask', 'reports'],
    latestAttemptAt: new Date().toISOString(),
  };
}
