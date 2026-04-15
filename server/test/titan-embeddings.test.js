// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { embedTexts, getEmbeddingDims } from '../src/lib/aws/titanEmbeddings.js';

describe('titan embeddings adapter', () => {
  it('returns normalized pseudo embeddings during test runs', async () => {
    const [vector] = await embedTexts(['Dental vendor readiness transcript']);
    expect(vector).toHaveLength(getEmbeddingDims());
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
    expect(magnitude).toBeGreaterThan(0.99);
    expect(magnitude).toBeLessThan(1.01);
  });
});
