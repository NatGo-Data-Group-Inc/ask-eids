// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, resetRuntimeData } from '../src/app.js';

describe('ask contracts', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '0';
    await resetRuntimeData();
  });

  it('returns a partial answer with evidence sources for decision questions', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/essence/ask')
      .send({ question: 'What decisions were made recently?' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('partial');
    expect(response.body.coverage.isPartial).toBe(true);
    expect(response.body.coverage.warnings.length).toBeGreaterThan(0);
    expect(response.body.sources[0].sourceId).toBeTruthy();
  });

  it('returns insufficient evidence for unsupported questions', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'What is the exact budget variance this month?' });

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('returns a scoped KB unavailable error for the kb failure harness', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/products/dental/ask?testCase=kbFailure')
      .send({ question: 'What decisions were made this sprint?' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('KB_UNAVAILABLE');
    expect(response.body.error.retryable).toBe(true);
  });

  it('rejects invalid role presets at the auth boundary', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/session?asRole=invalid');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
