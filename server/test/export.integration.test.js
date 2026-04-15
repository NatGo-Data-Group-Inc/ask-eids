// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';

async function waitForJobTerminal(app, jobId, maxAttempts = 40) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await request(app).get(`/api/v1/jobs/${jobId}`);
    const status = response.body.status;
    if (status === 'completed' || status === 'failed') {
      return response.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

describe('report export integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('creates export artifact jobs without mutating report content', async () => {
    const app = await buildApp();

    const reportStart = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });

    const reportJob = await waitForJobTerminal(app, reportStart.body.jobId);
    expect(reportJob.status).toBe('completed');

    const beforeExportReport = await request(app).get(`/api/v1/products/dental/reports/${reportStart.body.reportId}`);
    const beforeBody = beforeExportReport.body.sections.find((section) => section.sectionId === 'executive-summary').body;

    const exportStart = await request(app)
      .post(`/api/v1/products/dental/reports/${reportStart.body.reportId}/exports`)
      .send({ format: 'pdf' });
    expect(exportStart.status).toBe(202);

    const exportJob = await waitForJobTerminal(app, exportStart.body.jobId);
    expect(exportJob.status).toBe('completed');
    expect(exportJob.payload).toMatchObject({
      reportId: reportStart.body.reportId,
      productId: 'dental',
      format: 'pdf',
    });

    const download = await request(app).get(exportJob.result.downloadUrl);
    expect(download.status).toBe(200);
    const pdfText = Buffer.isBuffer(download.body)
      ? download.body.toString('utf8')
      : String(download.text || '');
    expect(pdfText.startsWith('%PDF')).toBe(true);

    const afterExportReport = await request(app).get(`/api/v1/products/dental/reports/${reportStart.body.reportId}`);
    const afterBody = afterExportReport.body.sections.find((section) => section.sectionId === 'executive-summary').body;
    expect(afterBody).toBe(beforeBody);
  });

  it('records failed exports while keeping report readable', async () => {
    const app = await buildApp();

    const reportStart = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });
    await waitForJobTerminal(app, reportStart.body.jobId);

    const failedExportStart = await request(app)
      .post(`/api/v1/products/dental/reports/${reportStart.body.reportId}/exports?testCase=exportFailure`)
      .send({ format: 'pdf' });
    expect(failedExportStart.status).toBe(202);

    const failedJob = await waitForJobTerminal(app, failedExportStart.body.jobId);
    expect(failedJob.status).toBe('failed');
    expect(failedJob.errorCode).toBe('INTERNAL_ERROR');

    const reportAfterFailure = await request(app).get(`/api/v1/products/dental/reports/${reportStart.body.reportId}`);
    expect(reportAfterFailure.status).toBe(200);
    expect(reportAfterFailure.body.sections.length).toBeGreaterThan(0);

    const state = await readRuntimeStateForTests();
    expect(state.jobs[failedExportStart.body.jobId].status).toBe('failed');
    expect(state.reports[reportStart.body.reportId]).toBeTruthy();
  });
});
