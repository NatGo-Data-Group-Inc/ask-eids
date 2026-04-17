import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  if (typeof value === 'string') {
    return value.replace(/\r\n/g, '\n');
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function buildReplayKey({
  normalizedPayload,
  promptVersion,
  modelId,
  sourceFamily,
  schemaVersion = 'source-schema-v1',
} = {}) {
  const digest = crypto
    .createHash('sha256')
    .update(stableStringify({
      normalizedPayload,
      promptVersion,
      modelId,
      sourceFamily,
      schemaVersion,
    }))
    .digest('hex');

  return path.posix.join(sourceFamily || 'unknown', modelId || 'unknown-model', promptVersion || 'local-dev', schemaVersion, `${digest}.json`);
}

function buildArtifactPath(evalCacheDir, replayKey) {
  const safeSegments = String(replayKey || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment));
  return path.join(evalCacheDir, ...safeSegments);
}

export function createSemanticReplayStore({ evalCacheDir }) {
  async function writeReplayArtifact({ replayKey, payloadEnvelope }) {
    const artifactPath = buildArtifactPath(evalCacheDir, replayKey);
    await fs.mkdir(path.dirname(artifactPath), { recursive: true });
    await fs.writeFile(artifactPath, JSON.stringify(payloadEnvelope, null, 2), 'utf8');
    return { replayKey, artifactPath };
  }

  async function readReplayArtifact({ replayKey }) {
    const artifactPath = buildArtifactPath(evalCacheDir, replayKey);
    try {
      const raw = await fs.readFile(artifactPath, 'utf8');
      return {
        replayKey,
        cacheHit: true,
        artifactPath,
        payloadEnvelope: JSON.parse(raw),
      };
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
      const miss = new Error('Replay evidence is unavailable for this source. Product understanding was not refreshed.');
      miss.code = 'REPLAY_CACHE_MISS';
      throw miss;
    }
  }

  return {
    writeReplayArtifact,
    readReplayArtifact,
  };
}
