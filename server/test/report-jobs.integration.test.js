// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';

async function waitForJobCompleted(app, jobId, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await request(app).get(`/api/v1/jobs/${jobId}`);
    if (response.body.status === 'completed') {
      return response.body;
    }
    if (response.body.status === 'failed') {
      throw new Error(`Job ${jobId} failed unexpectedly: ${response.body.message || 'unknown'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

describe('report jobs integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('stores durable report job payload and completes with persisted section bodies', async () => {
    const app = await buildApp();
    const start = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });

    expect(start.status).toBe(202);
    expect(start.body.jobId).toBeTruthy();
    expect(start.body.reportId).toBeTruthy();

    const queuedJob = await request(app).get(`/api/v1/jobs/${start.body.jobId}`);
    expect(queuedJob.status).toBe(200);
    expect(queuedJob.body.jobType).toBe('report');
    expect(queuedJob.body.payload).toMatchObject({
      productId: 'dental',
      reportId: start.body.reportId,
      reportType: 'weekly',
    });

    const completed = await waitForJobCompleted(app, start.body.jobId);
    expect(completed.result.reportId).toBe(start.body.reportId);

    const report = await request(app).get(`/api/v1/products/dental/reports/${start.body.reportId}`);
    expect(report.status).toBe(200);
    expect(Array.isArray(report.body.sections)).toBe(true);
    expect(report.body.sections.length).toBeGreaterThan(0);
    expect(report.body.sections[0].revision).toBeTypeOf('number');

    const state = await readRuntimeStateForTests();
    const section = state.reports[start.body.reportId].sections.find((item) => item.sectionId === 'executive-summary');
    expect(section.bodyGenerated).toBeTruthy();
    expect(section.bodyCurrent).toBeTruthy();
    expect(section.revision).toBeGreaterThanOrEqual(1);
  });

  it('returns 409 conflict for stale report section saves', async () => {
    const app = await buildApp();
    const start = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });

    await waitForJobCompleted(app, start.body.jobId);

    const report = await request(app).get(`/api/v1/products/dental/reports/${start.body.reportId}`);
    const section = report.body.sections.find((item) => item.sectionId === 'executive-summary');
    expect(section).toBeTruthy();

    const firstSave = await request(app)
      .patch(`/api/v1/products/dental/reports/${start.body.reportId}/sections/executive-summary`)
      .send({ body: 'First save from editor A', expectedRevision: section.revision });
    expect(firstSave.status).toBe(200);

    const staleSave = await request(app)
      .patch(`/api/v1/products/dental/reports/${start.body.reportId}/sections/executive-summary`)
      .send({ body: 'Second stale save from editor B', expectedRevision: section.revision });

    expect(staleSave.status).toBe(409);
    expect(staleSave.body.error.code).toBe('CONFLICT');
  });
});
