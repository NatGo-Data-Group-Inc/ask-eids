// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';

describe('telemetry ingestion', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('accepts telemetry events when persistence works', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/telemetry')
      .send({
        eventName: 'report.generated',
        timestamp: '2026-04-15T12:01:02Z',
        payload: { productId: 'dental' },
      });

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(true);

    const state = await readRuntimeStateForTests();
    expect(state.telemetryEvents.length).toBe(1);
  });

  it('remains non-blocking when telemetry persistence fails', async () => {
    const app = await buildApp();
    const response = await request(app)
      .post('/api/v1/telemetry?testCase=telemetryWriteFailure')
      .send({
        eventName: 'feature.error_encountered',
        timestamp: '2026-04-15T12:02:02Z',
        payload: { scope: 'reports', errorCode: 'INTERNAL_ERROR' },
      });

    expect(response.status).toBe(202);
    expect(response.body.accepted).toBe(true);

    const state = await readRuntimeStateForTests();
    expect(state.telemetryEvents.length).toBe(0);
  });
});
