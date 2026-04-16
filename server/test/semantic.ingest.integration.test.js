// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';

async function waitForJob(jobId, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await readRuntimeStateForTests();
    const job = state.jobs[jobId];
    if (job && ['completed', 'partial', 'failed'].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

function sampleEmailBody() {
  return [
    'From: Lowry <lowry@example.mil>',
    'To: Jaden <jaden@example.mil>',
    'Subject: Mitigation confirmed',
    'Date: Thu, 16 Apr 2026 09:48:21 -0400',
    '',
    'Team,',
    'We can proceed with the staged mitigation on April 18.',
    'I also confirmed the recovery packet will be delivered before close of business.',
    'Regards,',
    'Lowry',
  ].join('\r\n');
}

describe('semantic ingest integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('persists exact-citation email extraction metadata for Dental uploads in hybrid mode', async () => {
    const app = await buildApp();
    await request(app)
      .post('/api/v1/test/reset')
      .send({
        productId: 'dental',
        mode: 'wave-00',
        executionMode: 'hybrid',
        featureMode: 'live-email-trust-hardening',
      })
      .expect(200);

    const upload = await request(app)
      .post('/api/v1/products/dental/sources')
      .field('sourceType', 'email')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Vendor Mitigation Confirmed')
      .attach('file', Buffer.from(sampleEmailBody()), 'vendor-mitigation-confirmed.eml');

    expect(upload.status).toBe(202);
    expect(upload.body.effectiveExecutionMode).toEqual(expect.any(String));

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('completed');

    const state = await readRuntimeStateForTests();
    const source = state.productData.dental.sources.find((item) => item.id === upload.body.sourceId);
    expect(source).toBeTruthy();
    expect(source.citationMode).toBe('exact');
    expect(source.executionMode).toBe(upload.body.effectiveExecutionMode);
    expect(source.citations[0]).toMatchObject({
      kind: 'line_range',
      mode: 'exact',
    });

    const extraction = state.sourceExtractions.find((item) => item.sourceId === upload.body.sourceId);
    expect(extraction).toMatchObject({
      sourceFamily: 'email',
      citationMode: 'exact',
      executionModeEffective: upload.body.effectiveExecutionMode,
    });

    const promptRun = state.promptRuns.find((item) => item.targetId === upload.body.sourceId);
    expect(promptRun).toMatchObject({
      provider: expect.any(String),
      sourceFamily: 'email',
      citationMode: 'exact',
    });
  });

  it('preserves last-known-good product understanding when publication fails after email extraction', async () => {
    const app = await buildApp();
    await request(app)
      .post('/api/v1/test/reset')
      .send({
        productId: 'dental',
        mode: 'wave-00',
        executionMode: 'hybrid',
        featureMode: 'live-email-trust-hardening',
      })
      .expect(200);

    const baseline = await request(app).get('/api/v1/products/dental').expect(200);
    const priorStatus = baseline.body.product.statusLabel;

    const upload = await request(app)
      .post('/api/v1/products/dental/sources?testCase=publicationFailure')
      .field('sourceType', 'email')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Vendor Mitigation Confirmed')
      .attach('file', Buffer.from(sampleEmailBody()), 'vendor-mitigation-confirmed.eml');

    expect(upload.status).toBe(202);

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('partial');

    const product = await request(app).get('/api/v1/products/dental').expect(200);
    expect(product.body.product.statusLabel).toBe(priorStatus);
    expect(product.body.product.semanticState).toMatchObject({
      freshnessStatus: 'degraded',
      usesLastKnownGood: true,
    });

    const ask = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'Did the vendor commit to a recovery step?' })
      .expect(200);
    expect(ask.body.semanticState.usesLastKnownGood).toBe(true);
  });
});
