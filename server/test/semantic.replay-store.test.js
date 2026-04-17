// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildReplayKey,
  createSemanticReplayStore,
} from '../src/services/semantic/semanticReplayStore.service.js';

describe('semantic replay store', () => {
  let tempDir;
  let replayStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'askeids-replay-'));
    replayStore = createSemanticReplayStore({ evalCacheDir: tempDir });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('builds a stable sha256 replay key from canonicalized inputs', async () => {
    const input = {
      normalizedPayload: {
        productId: 'dental',
        sourceId: 'src-2401',
        sourceType: 'email',
        normalizedText: 'We can proceed with staged mitigation on April 18.\n',
        normalizationVersion: '2026-04-16-email-v2',
      },
      promptVersion: '2026-04-16-email-v2',
      modelId: 'amazon.nova-pro-v1:0',
      sourceFamily: 'email',
      schemaVersion: 'source-schema-v1',
    };

    const first = buildReplayKey(input);
    const second = buildReplayKey({
      ...input,
      normalizedPayload: {
        sourceType: 'email',
        sourceId: 'src-2401',
        normalizedText: 'We can proceed with staged mitigation on April 18.\n',
        productId: 'dental',
        normalizationVersion: '2026-04-16-email-v2',
      },
    });

    expect(first).toEqual(second);
    expect(first.startsWith('email/amazon.nova-pro-v1:0/2026-04-16-email-v2/source-schema-v1/')).toBe(true);
    expect(first.endsWith('.json')).toBe(true);
  });

  it('persists and reads a replay envelope by replay key', async () => {
    const envelope = {
      schemaVersion: 'source-schema-v1',
      promptVersion: '2026-04-16-email-v2',
      rawOutputText: '{"summary":"Vendor confirmed staged mitigation.","decisions":[],"warnings":[],"confidence":"high"}',
      parsedJson: {
        summary: 'Vendor confirmed staged mitigation.',
        decisions: [],
        warnings: [],
        confidence: 'high',
      },
      validatedPayload: {
        summary: 'Vendor confirmed staged mitigation.',
        decisions: [],
        warnings: [],
        confidence: 'high',
      },
    };

    const replayKey = buildReplayKey({
      normalizedPayload: {
        productId: 'dental',
        sourceId: 'src-2401',
        sourceType: 'email',
        normalizedText: 'We can proceed with staged mitigation on April 18.',
        normalizationVersion: '2026-04-16-email-v2',
      },
      promptVersion: '2026-04-16-email-v2',
      modelId: 'amazon.nova-pro-v1:0',
      sourceFamily: 'email',
      schemaVersion: 'source-schema-v1',
    });

    await replayStore.writeReplayArtifact({ replayKey, payloadEnvelope: envelope });
    const result = await replayStore.readReplayArtifact({ replayKey });

    expect(result.cacheHit).toBe(true);
    expect(result.replayKey).toBe(replayKey);
    expect(result.payloadEnvelope.validatedPayload.summary).toBe('Vendor confirmed staged mitigation.');
    expect(result.artifactPath).toContain(path.join('email', 'amazon.nova-pro-v1%3A0', '2026-04-16-email-v2', 'source-schema-v1'));
  });

  it('throws REPLAY_CACHE_MISS on missing artifact', async () => {
    await expect(replayStore.readReplayArtifact({ replayKey: 'email/amazon.nova-pro-v1:0/2026-04-16-email-v2/source-schema-v1/missing.json' }))
      .rejects
      .toMatchObject({ code: 'REPLAY_CACHE_MISS' });
  });
});
