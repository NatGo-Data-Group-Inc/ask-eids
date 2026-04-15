import { envString } from '../../config/env.js';
import { assertSingleRegionOperation, getRuntimeConfig } from '../../config/runtime.js';

const DEFAULT_ALLOWED_TEXT_MODELS = ['amazon.nova-lite-v1:0', 'amazon.nova-pro-v1:0'];
const DEFAULT_ALLOWED_EMBED_MODELS = ['amazon.titan-embed-text-v2:0'];

function parseAllowList(raw, fallback) {
  const values = String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? Array.from(new Set(values)) : [...fallback];
}

export function getBedrockComplianceStatus(config = getRuntimeConfig()) {
  const allowedTextModels = parseAllowList(envString('BEDROCK_ALLOWED_TEXT_MODEL_IDS', ''), DEFAULT_ALLOWED_TEXT_MODELS);
  const allowedEmbedModels = parseAllowList(envString('BEDROCK_ALLOWED_EMBED_MODEL_IDS', ''), DEFAULT_ALLOWED_EMBED_MODELS);
  const warnings = [];
  const errors = [];

  try {
    assertSingleRegionOperation(config);
  } catch (error) {
    errors.push(error.message);
  }

  if (!allowedTextModels.includes(config.bedrock.textModelId)) {
    errors.push(`Configured text model \"${config.bedrock.textModelId}\" is not in the approved allowlist.`);
  }
  if (!allowedEmbedModels.includes(config.bedrock.embedModelId)) {
    errors.push(`Configured embed model \"${config.bedrock.embedModelId}\" is not in the approved allowlist.`);
  }
  if (config.storage.mode !== 's3') {
    warnings.push('Artifact store is currently running in filesystem mode because S3 bucket configuration is incomplete.');
  }

  return {
    configured: Boolean(config.aws.region && config.bedrock.textModelId && config.bedrock.embedModelId),
    region: config.aws.region,
    textModelId: config.bedrock.textModelId,
    embedModelId: config.bedrock.embedModelId,
    allowedTextModels,
    allowedEmbedModels,
    storageMode: config.storage.mode,
    warnings,
    errors,
  };
}

export function assertTextModelAllowed(modelId, config = getRuntimeConfig()) {
  const candidate = String(modelId || config.bedrock.textModelId || '').trim();
  const allowed = getBedrockComplianceStatus(config).allowedTextModels;
  if (!candidate) {
    const error = new Error('Bedrock text model ID is not configured.');
    error.code = 'BEDROCK_TEXT_MODEL_MISSING';
    throw error;
  }
  if (!allowed.includes(candidate)) {
    const error = new Error(`Model \"${candidate}\" is not approved for text generation in this deployment.`);
    error.code = 'BEDROCK_TEXT_MODEL_NOT_ALLOWED';
    throw error;
  }
  return candidate;
}

export function assertEmbedModelAllowed(modelId, config = getRuntimeConfig()) {
  const candidate = String(modelId || config.bedrock.embedModelId || '').trim();
  const allowed = getBedrockComplianceStatus(config).allowedEmbedModels;
  if (!candidate) {
    const error = new Error('Bedrock embed model ID is not configured.');
    error.code = 'BEDROCK_EMBED_MODEL_MISSING';
    throw error;
  }
  if (!allowed.includes(candidate)) {
    const error = new Error(`Model \"${candidate}\" is not approved for embeddings in this deployment.`);
    error.code = 'BEDROCK_EMBED_MODEL_NOT_ALLOWED';
    throw error;
  }
  return candidate;
}

export function createAwsClientOptions(config = getRuntimeConfig()) {
  return {
    region: config.aws.region,
    useFipsEndpoint: config.aws.useFips,
  };
}
