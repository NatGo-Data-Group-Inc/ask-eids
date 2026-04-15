// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';

describe('audit events', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('persists audit events for weekly updates, report generation, report edits, and exports', async () => {
    const app = await buildApp();

    const weeklyResponse = await request(app)
      .post('/api/v1/products/dental/weekly-updates')
      .send({
        weekEnding: '2026-04-18',
        summary: 'Weekly summary text that is comfortably above one hundred characters to satisfy the validation posture for this integration test path.',
        accomplishments: 'Accomplishments text that is long enough to be realistic and to confirm the audit path.',
        risks: 'No new risks.',
        nextSteps: 'Confirm readiness and circulate the decision memo.',
      });
    expect(weeklyResponse.status).toBe(201);

    const reportResponse = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });
    expect(reportResponse.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 900));

    const editResponse = await request(app)
      .patch(`/api/v1/products/dental/reports/${reportResponse.body.reportId}/sections/executive-summary`)
      .send({ body: 'Updated executive summary from audit integration test.' });
    expect(editResponse.status).toBe(200);

    const exportResponse = await request(app)
      .post(`/api/v1/products/dental/reports/${reportResponse.body.reportId}/exports`)
      .send({ format: 'pdf' });
    expect(exportResponse.status).toBe(202);

    const state = await readRuntimeStateForTests();
    const actions = state.auditEvents.map((event) => event.action);
    expect(actions).toContain('weekly.published');
    expect(actions).toContain('report.generation_started');
    expect(actions).toContain('report.generated');
    expect(actions).toContain('report.section_saved');
    expect(actions).toContain('export.started');
  });
});
