// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, resetRuntimeData } from '../src/app.js';

describe('read scope authorization', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('returns 403 when read scope user requests out-of-scope product', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/products/essence?asRole=read');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('scopes portfolio and search results to authorized products for read users', async () => {
    const app = await buildApp();
    const portfolio = await request(app).get('/api/v1/portfolio?asRole=read');
    expect(portfolio.status).toBe(200);
    const visibleProductIds = [
      ...(portfolio.body.groups.needsAttention || []).map((product) => product.id),
      ...(portfolio.body.groups.onTrack || []).map((product) => product.id),
    ];
    expect(visibleProductIds).toEqual(['dental']);

    const search = await request(app).get('/api/v1/search?asRole=read&q=essence');
    expect(search.status).toBe(200);
    const allSearchItems = (search.body.groups || []).flatMap((group) => group.items);
    expect(allSearchItems.length).toBe(0);
  });
});
