// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, resetRuntimeData } from '../src/app.js';

describe('read contracts', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('returns the session contract', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/session');
    expect(response.status).toBe(200);
    expect(response.body.user.displayName).toBe('B. Jennings');
    expect(response.body.roles.map((role) => role.productId)).toContain('dental');
  });

  it('returns the portfolio contract', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/portfolio');
    expect(response.status).toBe(200);
    expect(response.body.summary.productCount).toBe(3);
    expect(response.body.groups.needsAttention.map((product) => product.id)).toEqual(['essence', 'dental']);
  });

  it('returns the product overview contract', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/products/dental');
    expect(response.status).toBe(200);
    expect(response.body.product.id).toBe('dental');
    expect(response.body.health.overall).toBe(94);
    expect(response.body.product.semanticState).toMatchObject({
      executionMode: expect.any(String),
      aggregateStatus: expect.any(String),
      aggregateVersion: expect.any(Number),
      featureMode: expect.any(String),
    });
    expect(response.body.overview.askSuggestions[0]).toContain('What decisions');
  });

  it('returns extraction-backed source detail contract for Dental sources', async () => {
    const app = await buildApp();
    const sourcesResponse = await request(app).get('/api/v1/products/dental/sources');
    expect(sourcesResponse.status).toBe(200);
    expect(sourcesResponse.body.items.length).toBeGreaterThan(0);

    const sourceId = sourcesResponse.body.items[0].id;
    const response = await request(app).get(`/api/v1/products/dental/sources/${sourceId}`);
    expect(response.status).toBe(200);
    expect(response.body.source.summary).toEqual(expect.any(String));
    expect(Array.isArray(response.body.source.citations)).toBe(true);
    expect(response.body.source.confidence).toEqual(expect.any(String));
    expect(Array.isArray(response.body.source.warnings)).toBe(true);
  });

  it('returns the FSFS reset contract in non-production mode', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/test/reset')
      .send({
        productId: 'dental',
        mode: 'wave-00',
        executionMode: 'replay',
        featureMode: 'extraction-first',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      productId: 'dental',
      mode: 'wave-00',
      executionMode: 'replay',
      featureMode: 'extraction-first',
    });
    expect(response.body.seededSources).toBeGreaterThan(0);
  });

  it('returns scoped search results', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/search?q=den');
    expect(response.status).toBe(200);
    expect(response.body.groups[0].items[0].route).toContain('/products/dental');
  });

  it('returns validation error for short search', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/search?q=d');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
