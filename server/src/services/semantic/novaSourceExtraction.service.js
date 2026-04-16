import { generateBedrockText } from '../../lib/aws/bedrockText.js';

function firstMeaningfulLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^subject:/i.test(line) && !/^from:/i.test(line) && !/^to:/i.test(line) && !/^cc:/i.test(line) && !/^date:/i.test(line))
    || '';
}

function safeJsonParse(text, code = 'EXTRACTION_INVALID') {
  try {
    return JSON.parse(text);
  } catch (error) {
    error.code = code;
    throw error;
  }
}

function stableHash(value) {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

function buildReplayExtraction({ normalized }) {
  const lines = String(normalized.normalizedText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const interestingLines = lines.filter((line) => /\b(proceed|decision|approved|approval|mitigation|action|confirm|committed?)\b/i.test(line));
  const anchorLine = interestingLines[0] || firstMeaningfulLine(normalized.normalizedText);
  return {
    sourceId: normalized.sourceId,
    productId: normalized.productId,
    sourceType: normalized.sourceType,
    summary: normalized.previewText || firstMeaningfulLine(normalized.normalizedText),
    decisions: anchorLine ? [{
      label: anchorLine.replace(/^[-*]\s*/, ''),
      confidence: 'high',
      anchorText: anchorLine,
    }] : [],
    warnings: [],
    confidence: 'high',
  };
}

async function buildLiveExtraction({ normalized, executionDecision, runtimeConfig }) {
  const liveMeta = {};
  const responseText = await generateBedrockText({
    systemPrompt: 'You extract trusted product evidence from a single email. Return strict JSON with keys: summary, decisions, warnings, confidence. Each decision item must include label, confidence, and anchorText copied exactly from the email.',
    promptText: [
      `Product: ${normalized.productId}`,
      `Source type: ${normalized.sourceType}`,
      `Prompt version: ${executionDecision.promptVersion}`,
      'Normalized email:',
      normalized.normalizedText,
      'Return only JSON.',
    ].join('\n\n'),
    modelId: runtimeConfig?.bedrock?.textModelId || null,
    maxTokens: 900,
    temperature: 0.1,
    onMeta: (meta) => Object.assign(liveMeta, meta),
  });

  if (!responseText) {
    const error = new Error('Live model unavailable for source extraction.');
    error.code = 'MODEL_UNAVAILABLE';
    throw error;
  }

  const parsed = safeJsonParse(responseText);
  return {
    extraction: {
      sourceId: normalized.sourceId,
      productId: normalized.productId,
      sourceType: normalized.sourceType,
      summary: parsed.summary || normalized.previewText || firstMeaningfulLine(normalized.normalizedText),
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      confidence: parsed.confidence || 'medium',
    },
    meta: liveMeta,
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

  let extraction;
  let meta = {};
  if (executionDecision.executionMode === 'live') {
    ({ extraction, meta } = await buildLiveExtraction({ normalized, executionDecision, runtimeConfig }));
  } else {
    extraction = buildReplayExtraction({ normalized });
    meta = {
      provider: 'replay',
      requestId: null,
      modelId: runtimeConfig?.bedrock?.textModelId || null,
      region: runtimeConfig?.aws?.region || null,
      usage: null,
      metrics: null,
    };
  }

  return {
    extraction,
    promptRun: {
      runId: `source-extraction-${normalized.sourceId}-${Date.now()}`,
      scope: 'source_extraction',
      targetId: normalized.sourceId,
      mode: executionDecision.executionMode,
      modelId: meta.modelId || runtimeConfig?.bedrock?.textModelId || null,
      promptVersion: executionDecision.promptVersion,
      latencyMs: Date.now() - startedAt,
      status: 'succeeded',
      errorJson: null,
      rawPayloadRef: null,
      provider: meta.provider || (executionDecision.executionMode === 'live' ? 'bedrock' : 'replay'),
      providerRequestId: meta.requestId || (executionDecision.executionMode === 'live' ? `bedrock-${Date.now()}` : null),
      sourceFamily: executionDecision.sourceFamily,
      inputHash: stableHash({
        sourceId: normalized.sourceId,
        normalizedText: normalized.normalizedText,
        normalizationVersion: normalized.normalizationVersion,
      }),
      outputHash: stableHash(extraction),
      replayKey: executionDecision.executionMode === 'replay'
        ? `${executionDecision.promptVersion}:${normalized.sourceId}`
        : null,
      citationMode: null,
      createdAt: new Date().toISOString(),
    },
  };
}
