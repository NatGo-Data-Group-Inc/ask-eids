// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, resetRuntimeData } from '../src/app.js';

describe('ask orchestration integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '0';
    await resetRuntimeData();
  });

  it('returns partial with coverage warning when structured retrieval fails but duckdb evidence succeeds', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/dental/ask?testCase=structuredFailure')
      .send({ question: 'What decisions were made in the vendor readiness meeting?' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('partial');
    expect(response.body.coverage.isPartial).toBe(true);
    expect(response.body.coverage.warnings.some((item) => String(item).toLowerCase().includes('structured'))).toBe(true);
    expect(response.body.sources.length).toBeGreaterThan(0);
  });

  it('retries one transient retrieval failure and records retry trace metadata', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/dental/ask?testCase=transientRetrieveFailure')
      .send({ question: 'What decisions were made this sprint?' });

    expect(response.status).toBe(200);
    expect(response.body.trace.retryCount).toBe(1);
    expect(response.body.trace.retryStages).toContain('duckdb.retrieve');
  });

  it('enforces backend-generated product retrieval filters', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/essence/ask')
      .send({ question: 'What changed most recently?' });

    expect(response.status).toBe(200);
    expect(response.body.trace.retrievalFilters.productId).toBe('essence');
    expect(response.body.trace.retrievalFilters.application).toBe('AskEIDS');
  });

  it('rejects unknown source citations from generation output and fails safely', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/dental/ask?testCase=invalidCitations')
      .send({ question: 'What decisions were made this sprint?' });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});
