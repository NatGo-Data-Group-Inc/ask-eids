import { generateBedrockText } from '../../lib/aws/bedrockText.js';
import { createSemanticReplayStore, buildReplayKey } from './semanticReplayStore.service.js';
import { validateSourceExtraction } from './extractionValidation.service.js';

function stripJsonCodeFence(text = '') {
  const trimmed = String(text || '').trim();
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fencedMatch ? fencedMatch[1].trim() : trimmed;
}

export function parseModelJson(text, code = 'EXTRACTION_INVALID') {
  try {
    return JSON.parse(stripJsonCodeFence(text));
  } catch (error) {
    error.code = code;
    throw error;
  }
}

function normalizeConfidence(value) {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['low', 'medium', 'high'].includes(normalized)) {
      return normalized;
    }
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric)) {
      value = numeric;
    } else {
      return value;
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 0.8) return 'high';
    if (value >= 0.5) return 'medium';
    return 'low';
  }

  return value;
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };

function deriveTopLevelConfidence(decisions = []) {
  const normalizedConfidences = decisions
    .map((decision) => normalizeConfidence(decision?.confidence))
    .filter((confidence) => Object.hasOwn(CONFIDENCE_RANK, confidence));
  if (!normalizedConfidences.length) {
    return 'medium';
  }
  return normalizedConfidences.reduce((lowest, current) => (
    CONFIDENCE_RANK[current] < CONFIDENCE_RANK[lowest] ? current : lowest
  ), normalizedConfidences[0]);
}

export function normalizeModelExtractionPayload(payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  const normalizedDecisions = Array.isArray(payload.decisions)
    ? payload.decisions.map((decision) => ({
      ...decision,
      confidence: normalizeConfidence(decision?.confidence),
    }))
    : payload.decisions;
  const normalizedConfidence = normalizeConfidence(payload.confidence);

  return {
    ...payload,
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    confidence: Object.hasOwn(CONFIDENCE_RANK, normalizedConfidence)
      ? normalizedConfidence
      : deriveTopLevelConfidence(normalizedDecisions),
    decisions: normalizedDecisions,
  };
}

export const EXTRACTION_SYSTEM_PROMPT = [
  'You extract trusted product evidence from one source.',
  'Return strict JSON only with exactly these keys: summary, decisions, warnings, confidence.',
  'A decision is an explicit go/no-go commitment, approval, prioritization, or directive made in the source.',
  'A caveat, condition, "not yet", "pending", risk, or qualifier on a decision is NOT a separate decision; it belongs in warnings.',
  'Do not duplicate the same content as both a decision and a warning.',
  'Each decision must include exactly these keys: label, confidence, anchorText.',
  'label is a short imperative phrase (verb + object) describing the commitment; never a single word like "approved" or "rejected".',
  'anchorText is a verbatim quoted span from the source that proves the decision.',
  'Each warning must be a single plain string sentence; never an object or nested fields.',
  'Confidence values must be exactly one of: low, medium, high.',
  'Top-level confidence is the minimum confidence across all decisions; if there are no decisions, it is medium.',
  'Do not return numeric confidence values.',
  'Do not wrap the JSON in markdown fences.',
].join(' ');

export function buildExtractionUserPrompt(normalized, executionDecision) {
  return [
    `Product: ${normalized.productId}`,
    `Source type: ${normalized.sourceType}`,
    `Prompt version: ${executionDecision.promptVersion}`,
    'Normalized source:',
    normalized.normalizedText,
    'Return only JSON. The top-level confidence field is required.',
  ].join('\n\n');
}

export async function buildLiveExtraction({ normalized, executionDecision, runtimeConfig }) {
  const liveMeta = {};
  const responseText = await generateBedrockText({
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    promptText: buildExtractionUserPrompt(normalized, executionDecision),
    modelId: runtimeConfig?.bedrock?.textModelId || null,
    maxTokens: 900,
    temperature: 0,
    onMeta: (meta) => Object.assign(liveMeta, meta),
  });

  if (!responseText) {
    const error = new Error('Live model unavailable for source extraction.');
    error.code = 'MODEL_UNAVAILABLE';
    throw error;
  }

  const parsed = parseModelJson(responseText);
  const normalizedPayload = normalizeModelExtractionPayload(parsed);
  const validated = validateSourceExtraction({
    sourceFamily: executionDecision.sourceFamily,
    payload: normalizedPayload,
  });

  return {
    rawOutputText: responseText,
    parsedJson: parsed,
    validatedPayload: validated,
    providerMeta: liveMeta,
  };
}

export async function extractSourceWithNova({
  normalized,
  executionDecision,
  runtimeConfig,
  testCase = '',
} = {}) {
  const startedAt = Date.now();
  if (testCase === 'forcedInvalidExtraction') {
    const error = new Error('Injected extraction schema failure.');
    error.code = 'EXTRACTION_INVALID';
    throw error;
  }

  const replayStore = createSemanticReplayStore({
    evalCacheDir: runtimeConfig?.semantic?.evalCacheDir,
  });
  const replayKey = buildReplayKey({
    normalizedPayload: {
      productId: normalized.productId,
      sourceType: normalized.sourceType,
      normalizedText: normalized.normalizedText,
      normalizationVersion: normalized.normalizationVersion,
    },
    promptVersion: executionDecision.promptVersion,
    modelId: runtimeConfig?.bedrock?.textModelId || null,
    sourceFamily: executionDecision.sourceFamily,
    schemaVersion: 'source-schema-v1',
  });

  let envelope;
  let provider = 'replay';
  let providerRequestId = null;
  let replayStatus = 'not_applicable';

  if (executionDecision.executionMode === 'replay') {
    const replayResult = await replayStore.readReplayArtifact({ replayKey });
    envelope = replayResult.payloadEnvelope;
    replayStatus = 'hit';
  } else {
    envelope = await buildLiveExtraction({ normalized, executionDecision, runtimeConfig });
    provider = 'bedrock';
    providerRequestId = envelope.providerMeta?.requestId || `bedrock-${Date.now()}`;
    replayStatus = 'not_applicable';
  }

  const validatedPayload = validateSourceExtraction({
    sourceFamily: executionDecision.sourceFamily,
    payload: envelope.validatedPayload || envelope.parsedJson || envelope,
  });

  return {
    extraction: {
      sourceId: normalized.sourceId,
      productId: normalized.productId,
      sourceType: normalized.sourceType,
      ...validatedPayload,
    },
    replayKey,
    replayStatus,
    promptRun: {
      runId: `source-extraction-${normalized.sourceId}-${Date.now()}`,
      runRole: 'source_extraction',
      scope: 'source_extraction',
      targetId: normalized.sourceId,
      mode: executionDecision.executionMode,
      modelId: runtimeConfig?.bedrock?.textModelId || null,
      promptVersion: executionDecision.promptVersion,
      latencyMs: Date.now() - startedAt,
      status: 'succeeded',
      errorJson: null,
      rawPayloadRef: null,
      provider,
      providerRequestId,
      sourceFamily: executionDecision.sourceFamily,
      replayKey: executionDecision.executionMode === 'replay' ? replayKey : null,
      cacheHit: executionDecision.executionMode === 'replay',
      citationMode: null,
      createdAt: new Date().toISOString(),
    },
  };
}
