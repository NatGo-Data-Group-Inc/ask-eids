// @vitest-environment node
import fs from 'node:fs/promises';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, readRuntimeStateForTests, resetRuntimeData, updateRuntimeStateForTests } from '../src/app.js';
import { getRuntimeConfig } from '../src/config/runtime.js';

describe('runtime state repository', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('uses durable duckdb state store instead of runtime json', async () => {
    const config = getRuntimeConfig();
    expect(config.storage.paths.stateDbFile).toBeDefined();

    const stats = await fs.stat(config.storage.paths.stateDbFile);
    expect(stats.size).toBeGreaterThan(0);
    await expect(fs.access(config.storage.paths.runtimeFile)).rejects.toBeTruthy();
  });

  it('persists mutations across app instances using durable state', async () => {
    const appA = await buildApp();
    const publish = await request(appA)
      .post('/api/v1/products/dental/weekly-updates')
      .send({
        weekEnding: '2026-04-18',
        summary: 'This weekly summary is long enough to pass validation and verify that durable state survives a new app instance.',
        accomplishments: 'Accomplishments text that confirms durable persistence from one app instance to another.',
        risks: 'No new risks this week.',
        nextSteps: 'Confirm readiness and capture final stakeholder notes.',
      });

    expect(publish.status).toBe(201);

    const appB = await buildApp();
    const sources = await request(appB).get('/api/v1/products/dental/sources?type=weekly');
    expect(sources.status).toBe(200);
    expect(sources.body.items.some((item) => item.title === 'Weekly Update - 2026-04-18')).toBe(true);
  });

  it('preserves prior snapshot state if a recompute/update mutator fails', async () => {
    const before = await readRuntimeStateForTests();
    const beforeHealth = before.products.find((item) => item.id === 'dental').health.overall;
    const beforeGap = before.products.find((item) => item.id === 'dental').biggestGap;

    await expect(updateRuntimeStateForTests((draft) => {
      const dental = draft.products.find((item) => item.id === 'dental');
      dental.health.overall = 1;
      dental.biggestGap = 'bad write should never persist';
      throw new Error('forced snapshot recompute failure');
    })).rejects.toThrow('forced snapshot recompute failure');

    const after = await readRuntimeStateForTests();
    const afterDental = after.products.find((item) => item.id === 'dental');
    expect(afterDental.health.overall).toBe(beforeHealth);
    expect(afterDental.biggestGap).toBe(beforeGap);
  });

  it('persists report generated and current section bodies separately', async () => {
    const app = await buildApp();

    const reportStart = await request(app)
      .post('/api/v1/products/dental/reports')
      .send({ reportType: 'weekly', period: { preset: 'current' } });
    expect(reportStart.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 550));

    const editedBody = 'Phase 2 edit test body for generated/current separation.';
    const save = await request(app)
      .patch(`/api/v1/products/dental/reports/${reportStart.body.reportId}/sections/executive-summary`)
      .send({ body: editedBody });
    expect(save.status).toBe(200);

    const state = await readRuntimeStateForTests();
    const section = state.reports[reportStart.body.reportId].sections.find((item) => item.sectionId === 'executive-summary');
    expect(section.bodyGenerated).toBeTruthy();
    expect(section.bodyCurrent).toBe(editedBody);
    expect(section.body).toBe(editedBody);
    expect(section.bodyGenerated).not.toBe(section.bodyCurrent);
  });

  it('persists Dental extraction records, aggregate snapshots, and prompt runs in durable state', async () => {
    const state = await readRuntimeStateForTests();

    expect(Array.isArray(state.sourceExtractions)).toBe(true);
    expect(state.sourceExtractions.length).toBeGreaterThan(0);
    expect(state.sourceExtractions.some((item) => item.productId === 'dental')).toBe(true);
    expect(state.sourceExtractions.some((item) => item.executionModeEffective)).toBe(true);
    expect(state.sourceExtractions.some((item) => item.citationMode)).toBe(true);

    expect(Array.isArray(state.productAggregates)).toBe(true);
    expect(state.productAggregates.some((item) => item.productId === 'dental' && item.published === true)).toBe(true);
    expect(state.productAggregates.some((item) => item.freshnessStatus)).toBe(true);

    expect(Array.isArray(state.promptRuns)).toBe(true);
    expect(state.promptRuns.some((item) => item.targetId === 'dental')).toBe(true);
    expect(state.promptRuns.some((item) => item.provider)).toBe(true);
  });
});
