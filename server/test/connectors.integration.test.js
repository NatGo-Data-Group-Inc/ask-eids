// @vitest-environment node
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildApp,
  readRuntimeStateForTests,
  resetRuntimeData,
  updateRuntimeStateForTests,
} from '../src/app.js';

async function waitForJobTerminal(app, jobId, maxAttempts = 50) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await request(app).get(`/api/v1/jobs/${jobId}`);
    const status = response.body.status;
    if (['completed', 'partial', 'failed'].includes(status)) {
      return response.body;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function runConnectorSync(app, path) {
  const start = await request(app).post(path).send({});
  expect(start.status).toBe(202);
  expect(start.body.jobId).toBeTruthy();
  return waitForJobTerminal(app, start.body.jobId);
}

describe('connector integration', () => {
  const previousMcp = process.env.ENABLE_ADO_MCP_ENRICHMENT;

  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    process.env.ENABLE_ADO_MCP_ENRICHMENT = '0';
    await resetRuntimeData();
  });

  afterEach(() => {
    process.env.ENABLE_ADO_MCP_ENRICHMENT = previousMcp;
  });

  it('mailbox sync strips quoted/disclaimer text, links attachments, suppresses duplicates, and advances cursor', async () => {
    const app = await buildApp();
    const firstJob = await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync');
    expect(['completed', 'partial']).toContain(firstJob.status);

    const firstState = await readRuntimeStateForTests();
    const firstProfile = firstState.connectorProfiles?.['mailbox-dental'];
    expect(firstProfile?.lastCursor).toBeTruthy();

    const emailSources = firstState.productData.dental.sources.filter((source) => source.externalRef?.startsWith('mail-msg-'));
    expect(emailSources.length).toBeGreaterThan(0);

    const firstEmail = emailSources[0];
    expect(firstEmail.previewText).not.toContain('On Wed');
    expect(firstEmail.previewText).not.toContain('CONFIDENTIALITY NOTICE');

    const attachmentSources = firstState.productData.dental.sources.filter((source) => source.type === 'attachment');
    expect(attachmentSources.length).toBeGreaterThan(0);
    expect(attachmentSources[0].metadata?.parentSourceId).toBeTruthy();

    const firstCount = emailSources.length;

    const secondJob = await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync');
    expect(['completed', 'partial']).toContain(secondJob.status);

    const secondState = await readRuntimeStateForTests();
    const secondCount = secondState.productData.dental.sources.filter((source) => source.externalRef?.startsWith('mail-msg-')).length;
    expect(secondCount).toBe(firstCount);
  });

  it('mailbox connector resumes cursor and ingests only new messages', async () => {
    const app = await buildApp();
    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync');
    const baselineState = await readRuntimeStateForTests();
    const baselineCount = baselineState.productData.dental.sources.filter((source) => source.externalRef?.startsWith('mail-msg-')).length;

    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync?testCase=mailboxNewMessage');
    const newState = await readRuntimeStateForTests();
    const newCount = newState.productData.dental.sources.filter((source) => source.externalRef?.startsWith('mail-msg-')).length;
    expect(newCount).toBe(baselineCount + 1);
    expect(newState.connectorProfiles['mailbox-dental'].lastCursor).toBeGreaterThanOrEqual(1003);

    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync?testCase=mailboxNewMessage');
    const finalState = await readRuntimeStateForTests();
    const finalCount = finalState.productData.dental.sources.filter((source) => source.externalRef?.startsWith('mail-msg-')).length;
    expect(finalCount).toBe(newCount);
  });

  it('ADO REST sync upserts structured rows and timeline state deterministically', async () => {
    const app = await buildApp();
    const first = await runConnectorSync(app, '/api/v1/connectors/ado/sync');
    expect(['completed', 'partial']).toContain(first.status);

    const stateAfterFirst = await readRuntimeStateForTests();
    const risks = stateAfterFirst.productData.dental.data.risks;
    const blockers = stateAfterFirst.productData.dental.data.blockers;
    const pi = stateAfterFirst.productData.dental.data.pi;
    expect(risks.some((row) => row.id === 'R-ADO-22')).toBe(true);
    expect(blockers.some((row) => row.id === 'B-ADO-09')).toBe(true);
    expect(pi.some((row) => row.id === 'PI-ADO-04')).toBe(true);

    const riskCount = risks.length;
    await runConnectorSync(app, '/api/v1/connectors/ado/sync');
    const stateAfterSecond = await readRuntimeStateForTests();
    expect(stateAfterSecond.productData.dental.data.risks.length).toBe(riskCount);

    await runConnectorSync(app, '/api/v1/connectors/ado/sync?testCase=adoUpdate');
    const stateAfterUpdate = await readRuntimeStateForTests();
    const updatedRisk = stateAfterUpdate.productData.dental.data.risks.find((row) => row.id === 'R-ADO-22');
    expect(updatedRisk.status).toBe('closed');
    expect(stateAfterUpdate.productData.dental.timelineGroups.some((group) => group.entries.some((entry) => entry.type === 'ado'))).toBe(true);
  });

  it('MCP enrichment is non-blocking when disabled and when enabled-but-failing', async () => {
    const app = await buildApp();

    process.env.ENABLE_ADO_MCP_ENRICHMENT = '0';
    const disabledJob = await runConnectorSync(app, '/api/v1/connectors/ado/sync?testCase=mcpFailure');
    expect(disabledJob.status).toBe('completed');

    process.env.ENABLE_ADO_MCP_ENRICHMENT = '1';
    const enabledJob = await runConnectorSync(app, '/api/v1/connectors/ado/sync?testCase=mcpFailure');
    expect(['completed', 'partial']).toContain(enabledJob.status);

    const state = await readRuntimeStateForTests();
    const latestRun = [...(state.syncRuns || [])].find((run) => run.connectorType === 'ado-rest');
    expect(latestRun).toBeTruthy();
    expect(state.productData.dental.data.risks.some((row) => row.id === 'R-ADO-22')).toBe(true);
  });

  it('connector lag and repeated failures are observable and alertable', async () => {
    const app = await buildApp();

    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync?testCase=mailboxFailure');
    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync?testCase=mailboxFailure');
    await runConnectorSync(app, '/api/v1/connectors/mailboxes/sync?testCase=mailboxFailure');

    await updateRuntimeStateForTests((draft) => {
      if (draft.connectorProfiles?.['ado-rest-dental']) {
        draft.connectorProfiles['ado-rest-dental'].lastRunAt = '2026-01-01T00:00:00.000Z';
      }
      return draft;
    });

    const statusResponse = await request(app).get('/api/v1/connectors/status');
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.alerts.some((alert) => alert.code === 'connector.failure_streak')).toBe(true);
    expect(statusResponse.body.alerts.some((alert) => alert.code === 'connector.lag')).toBe(true);
  });
});
