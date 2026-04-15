import crypto from 'node:crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { envBool } from '../../config/env.js';
import { getRuntimeConfig } from '../../config/runtime.js';
import { assertEmbedModelAllowed, createAwsClientOptions } from './bedrockCompliance.js';

function l2Normalize(vector) {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const magnitude = Math.sqrt(sum) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

function pseudoEmbedding(text, dims) {
  const seed = crypto.createHash('sha256').update(String(text || '')).digest();
  let state = seed.readUInt32LE(0) ^ seed.readUInt32LE(4);
  const vector = new Array(dims);
  for (let index = 0; index < dims; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const normalized = (state >>> 0) / 0xffffffff;
    vector[index] = normalized * 2 - 1;
  }
  return l2Normalize(vector);
}

export function embeddingsAvailable(config = getRuntimeConfig()) {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return false;
  }
  if (!envBool('EIDS_ENABLE_BEDROCK', false)) {
    return false;
  }
  return Boolean(config.aws.region && config.bedrock.embedModelId);
}

export function getEmbeddingDims(config = getRuntimeConfig()) {
  return config.bedrock.embedDims;
}

async function embedSingleTitan(text, { client, config, modelId, dims }) {
  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: String(text || ''),
      dimensions: dims,
      normalize: true,
    }),
  });
  const response = await client.send(command);
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  const embedding = Array.isArray(parsed?.embedding) ? parsed.embedding : [];
  if (embedding.length !== dims) {
    throw new Error(`Embedding dimension mismatch: expected ${dims}, received ${embedding.length}.`);
  }
  return l2Normalize(embedding);
}

export async function embedTexts(texts, { client = null } = {}) {
  const config = getRuntimeConfig();
  const dims = getEmbeddingDims(config);
  const items = Array.isArray(texts) ? texts : [];

  if (!items.length) return [];

  if (embeddingsAvailable(config)) {
    try {
      const runtimeClient = client || new BedrockRuntimeClient(createAwsClientOptions(config));
      const modelId = assertEmbedModelAllowed(config.bedrock.embedModelId, config);
      const embeddings = [];
      for (const text of items) {
        embeddings.push(await embedSingleTitan(text, { client: runtimeClient, config, modelId, dims }));
      }
      return embeddings;
    } catch (error) {
      if (!config.retrieval.allowPseudoEmbeddings) {
        throw error;
      }
    }
  }

  if (!config.retrieval.allowPseudoEmbeddings) {
    throw new Error('Titan embeddings are unavailable and pseudo embeddings are disabled.');
  }

  return items.map((text) => pseudoEmbedding(text, dims));
}

export async function embedQuery(text, options = {}) {
  const [embedding] = await embedTexts([text], options);
  return embedding || [];
}
