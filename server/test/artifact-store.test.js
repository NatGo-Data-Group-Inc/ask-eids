// @vitest-environment node
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createArtifactStore } from '../src/lib/storage/artifactStore.js';

const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('artifact store', () => {
  it('writes and reads filesystem artifacts when s3 buckets are not configured', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'askeids-artifacts-'));
    tempRoots.push(root);

    const store = createArtifactStore({
      config: {
        aws: {
          region: 'us-gov-west-1',
          useFips: true,
          rawBucket: '',
          normalizedBucket: '',
          exportBucket: '',
        },
        storage: {
          mode: 'filesystem',
          paths: {
            rawArtifactsDir: path.join(root, 'raw'),
            normalizedArtifactsDir: path.join(root, 'normalized'),
            exportArtifactsDir: path.join(root, 'exports'),
          },
        },
      },
    });

    await store.writeTextArtifact({
      bucketType: 'normalized',
      key: 'dental/sources/src-1/source.txt',
      content: 'Derived transcript text',
    });

    expect(await store.exists({ bucketType: 'normalized', key: 'dental/sources/src-1/source.txt' })).toBe(true);
    expect(await store.readTextArtifact({ bucketType: 'normalized', key: 'dental/sources/src-1/source.txt' })).toBe('Derived transcript text');
    expect(store.describeLocation({ bucketType: 'normalized', key: 'dental/sources/src-1/source.txt' }).mode).toBe('filesystem');
  });
});
