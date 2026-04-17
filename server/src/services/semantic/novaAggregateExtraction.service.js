import { generateBedrockText } from '../../lib/aws/bedrockText.js';
import { parseModelJson } from './novaSourceExtraction.service.js';
import { validateAggregateContent, STATUS_TO_LABEL } from './aggregateValidation.service.js';

export const AGGREGATE_SYSTEM_PROMPT = [
  'You assess the current project status of a product by synthesizing per-document extractions that have already been validated.',
  'Return strict JSON only with exactly these keys: productId, status, statusLabel, summary, confidence, drivers, riskFactors.',
  'status must be exactly one of: healthy, caution, risk.',
  'statusLabel must match status via this mapping: healthy → "On Track", caution → "Caution", risk → "At Risk". Any other pairing is invalid.',
  'A driver is a factor pushing the project in a direction. Each driver has exactly these keys: title, direction, anchorSourceIds.',
  'direction must be exactly one of: positive, neutral, negative.',
  'A riskFactor is an open concern. Each riskFactor has exactly these keys: title, severity, anchorSourceIds.',
  'severity must be exactly one of: low, medium, high.',
  'anchorSourceIds is a non-empty array of sourceIds that MUST exist in the provided extractions. Never invent or modify source IDs.',
  'A single warning mentioned in one extraction is usually a riskFactor, not a status downgrade by itself. Weight severity by recurrence and magnitude across extractions.',
  'summary is 1-3 sentences explaining the status call in plain English; at least 40 characters.',
  'confidence is the overall confidence in the status assessment: high when multiple recent extractions agree; medium when signals are mixed; low when only 1-2 extractions are available or signals conflict.',
  'Do not return numeric values. Do not wrap the JSON in markdown fences.',
  'Never mention individual product names (e.g. "Dental", "Essence") in instructions about how to score; treat every product with the same rubric.',
].join(' ');

function serialiseExtractionsForPrompt(extractions = []) {
  return extractions
    .map((entry) => {
      const payload = entry.payload || {};
      return JSON.stringify({
        sourceId: entry.sourceId,
        sourceType: entry.sourceType,
        productId: entry.productId,
        summary: payload.summary,
        decisions: payload.decisions,
        warnings: payload.warnings,
        confidence: payload.confidence,
        documentDate: entry.documentDate || payload.documentDate || null,
      });
    })
    .join('\n---\n');
}

export function buildAggregateUserPrompt({ productId, productName, productMission = '', extractions = [], promptVersion = 'aggregate-eval-1' }) {
  return [
    `Product: ${productName} (${productId})`,
    productMission ? `Mission: ${productMission}` : 'Mission: (not provided — assess based on extractions alone)',
    `Total extractions considered: ${extractions.length}`,
    `Prompt version: ${promptVersion}`,
    '',
    'Extractions (most recent first):',
    extractions.length ? serialiseExtractionsForPrompt(extractions) : '(no extractions yet)',
    '',
    'Return only JSON. All anchorSourceIds must come from the sourceIds listed above.',
  ].join('\n\n');
}

function assertAnchorSourceIds(payload, extractions) {
  const known = new Set((extractions || []).map((entry) => String(entry.sourceId)));
  const violations = [];
  for (const group of ['drivers', 'riskFactors']) {
    const items = Array.isArray(payload[group]) ? payload[group] : [];
    items.forEach((item, index) => {
      const ids = Array.isArray(item.anchorSourceIds) ? item.anchorSourceIds : [];
      ids.forEach((id) => {
        if (!known.has(String(id))) {
          violations.push(`${group}[${index}].anchorSourceIds contains unknown id "${id}"`);
        }
      });
    });
  }
  if (violations.length) {
    const error = new Error('Aggregate output references sourceIds that do not exist in the input extractions.');
    error.code = 'AGGREGATE_CONTENT_INVALID';
    error.validationErrors = violations.map((message) => ({ message }));
    throw error;
  }
}

export async function extractAggregateWithNova({
  productId,
  productName,
  productMission = '',
  extractions = [],
  executionDecision,
  runtimeConfig,
} = {}) {
  const startedAt = Date.now();
  const liveMeta = {};
  const promptVersion = executionDecision?.promptVersion || 'aggregate-eval-1';

  const responseText = await generateBedrockText({
    systemPrompt: AGGREGATE_SYSTEM_PROMPT,
    promptText: buildAggregateUserPrompt({ productId, productName, productMission, extractions, promptVersion }),
    modelId: runtimeConfig?.bedrock?.textModelId || null,
    maxTokens: 1200,
    temperature: 0,
    onMeta: (meta) => Object.assign(liveMeta, meta),
  });

  if (!responseText) {
    const error = new Error('Live model unavailable for aggregate synthesis.');
    error.code = 'MODEL_UNAVAILABLE';
    throw error;
  }

  const parsed = parseModelJson(responseText, 'AGGREGATE_CONTENT_INVALID');
  validateAggregateContent({ payload: parsed });
  assertAnchorSourceIds(parsed, extractions);

  return {
    payload: parsed,
    rawOutputText: responseText,
    providerMeta: liveMeta,
    promptRun: {
      runId: `aggregate-${productId}-${Date.now()}`,
      runRole: 'aggregate_synthesis',
      scope: 'product_aggregate',
      targetId: productId,
      mode: executionDecision?.executionMode || 'live',
      modelId: runtimeConfig?.bedrock?.textModelId || null,
      promptVersion,
      latencyMs: Date.now() - startedAt,
      status: 'succeeded',
      provider: 'bedrock',
      providerRequestId: liveMeta.requestId || null,
      sourceFamily: 'aggregate',
      createdAt: new Date().toISOString(),
    },
  };
}

export { STATUS_TO_LABEL };
