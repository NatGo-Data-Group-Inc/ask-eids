import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { envBool } from '../../config/env.js';
import { getRuntimeConfig } from '../../config/runtime.js';
import { assertTextModelAllowed, createAwsClientOptions } from './bedrockCompliance.js';

function readTextFromContent(content = []) {
  return content
    .map((block) => block?.text || '')
    .join('')
    .trim();
}

export function bedrockTextAvailable(config = getRuntimeConfig()) {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return false;
  }
  if (!envBool('EIDS_ENABLE_BEDROCK', false)) {
    return false;
  }
  return Boolean(config.aws.region && config.bedrock.textModelId);
}

export async function generateBedrockText({
  systemPrompt = '',
  promptText,
  modelId = null,
  maxTokens = 1200,
  temperature = 0.2,
  client = null,
  onMeta = null,
} = {}) {
  const config = getRuntimeConfig();
  if (!bedrockTextAvailable(config)) return null;
  const resolvedModelId = assertTextModelAllowed(modelId, config);
  const runtimeClient = client || new BedrockRuntimeClient(createAwsClientOptions(config));
  const command = new ConverseCommand({
    modelId: resolvedModelId,
    system: systemPrompt ? [{ text: systemPrompt }] : undefined,
    messages: [{ role: 'user', content: [{ text: String(promptText || '') }] }],
    inferenceConfig: {
      maxTokens,
      temperature,
    },
  });
  const response = await runtimeClient.send(command);
  const text = readTextFromContent(response?.output?.message?.content || []);
  onMeta?.({
    provider: 'bedrock',
    requestId: response?.$metadata?.requestId || null,
    modelId: resolvedModelId,
    region: config.aws.region,
    stopReason: response?.stopReason || null,
    usage: response?.usage || null,
    metrics: response?.metrics || null,
  });
  return text || null;
}

export async function generateBedrockJson(options = {}) {
  const text = await generateBedrockText(options);
  if (!text) return null;
  return JSON.parse(text);
}
