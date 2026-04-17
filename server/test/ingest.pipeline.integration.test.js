// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeConfig } from '../src/config/runtime.js';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';
import { createPrototypeDuckDbStore, resetPrototypeDuckDbStore } from '../src/rag/prototypeDuckDbStore.js';

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

describe('ingest pipeline integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
    await resetPrototypeDuckDbStore();
  });

  it('writes raw + normalized + chunk artifacts and marks transcript source indexed on success', async () => {
    const app = await buildApp();
    const uploadResponse = await request(app)
      .post('/api/v1/products/dental/transcripts')
      .field('meetingTitle', 'Pipeline Success Transcript')
      .field('meetingDate', '2026-04-11')
      .field('attendees', 'Lowry')
      .field('attendees', 'Juan')
      .field('notes', 'Decision and actions captured.')
      .attach(
        'file',
        Buffer.from('00:01:14 Lowry: Decision: Move forward with vendor pilot.\n00:02:30 Juan: Action: Send final readiness packet by Friday.'),
        'pipeline-success.txt'
      );

    expect(uploadResponse.status).toBe(202);

    const job = await waitForJob(uploadResponse.body.jobId);
    expect(job.status).toBe('completed');

    const state = await readRuntimeStateForTests();
    const source = state.productData.dental.sources.find((item) => item.id === uploadResponse.body.sourceId);
    expect(source).toBeTruthy();
    expect(source.ingestStatus).toBe('completed');
    expect(source.indexed).toBe(true);
    expect(Array.isArray(source.chunkArtifacts)).toBe(true);
    expect(source.chunkArtifacts.length).toBeGreaterThan(0);
    expect(Array.isArray(source.extracted?.decisions)).toBe(true);
    expect(Array.isArray(source.extracted?.actionItems)).toBe(true);
    expect(source.extracted.decisions.some((item) => item.includes('Move forward with vendor pilot'))).toBe(true);
    expect(source.extracted.actionItems.some((item) => item.includes('Send final readiness packet'))).toBe(true);
    expect(state.productData.dental.sourceContents[uploadResponse.body.sourceId]).toContain('00:01:14');

    const runtime = getRuntimeConfig();
    const normalizedPath = path.join(runtime.storage.paths.normalizedArtifactsDir, source.normalizedArtifactKey);
    const chunkPath = path.join(runtime.storage.paths.normalizedArtifactsDir, source.chunkArtifacts[0].chunkKey);
    const sidecarPath = path.join(runtime.storage.paths.normalizedArtifactsDir, source.chunkArtifacts[0].metadataKey);
    await expect(fs.access(normalizedPath)).resolves.toBeUndefined();
    await expect(fs.access(chunkPath)).resolves.toBeUndefined();
    await expect(fs.access(sidecarPath)).resolves.toBeUndefined();

    const store = await createPrototypeDuckDbStore();
    const results = await store.search({
      query: 'vendor pilot readiness packet friday',
      filters: {
        application: 'AskEIDS',
        environment: process.env.NODE_ENV ?? 'test',
        productId: 'dental',
        sourceId: uploadResponse.body.sourceId,
      },
      topK: 5,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.chunkId.startsWith(`${uploadResponse.body.sourceId}::`))).toBe(true);
  });

  it('marks source as partial when extraction fails but normalized evidence remains available', async () => {
    const app = await buildApp();
    const uploadResponse = await request(app)
      .post('/api/v1/products/dental/transcripts?testCase=extractFailure')
      .field('meetingTitle', 'Pipeline Partial Transcript')
      .field('meetingDate', '2026-04-12')
      .attach('file', Buffer.from('Decision: keep timeline.'), 'pipeline-partial.txt');

    expect(uploadResponse.status).toBe(202);
    const job = await waitForJob(uploadResponse.body.jobId);
    expect(job.status).toBe('partial');

    const state = await readRuntimeStateForTests();
    const source = state.productData.dental.sources.find((item) => item.id === uploadResponse.body.sourceId);
    expect(source.ingestStatus).toBe('partial');
    expect(source.indexed).toBe(true);
    expect(source.normalizedArtifactKey).toBeTruthy();
  });

  it('marks source unindexed and job failed retryable when retrieval indexing fails', async () => {
    const app = await buildApp();
    const uploadResponse = await request(app)
      .post('/api/v1/products/dental/transcripts?testCase=indexFailure')
      .field('meetingTitle', 'Pipeline Failed Transcript')
      .field('meetingDate', '2026-04-13')
      .attach('file', Buffer.from('Decision: staged fallback only.'), 'pipeline-failed.txt');

    expect(uploadResponse.status).toBe(202);
    const job = await waitForJob(uploadResponse.body.jobId);
    expect(job.status).toBe('failed');
    expect(job.retryable).toBe(true);

    const state = await readRuntimeStateForTests();
    const source = state.productData.dental.sources.find((item) => item.id === uploadResponse.body.sourceId);
    expect(source.ingestStatus).toBe('failed');
    expect(source.indexed).toBe(false);
  });

  it('applies OCR fallback for low-text pdf uploads when extraction is insufficient', async () => {
    const app = await buildApp();
    const uploadResponse = await request(app)
      .post('/api/v1/products/dental/transcripts?testCase=ocrFallback')
      .field('meetingTitle', 'Pipeline OCR Transcript')
      .field('meetingDate', '2026-04-14')
      .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF'), 'pipeline-ocr.pdf');

    expect(uploadResponse.status).toBe(202);
    const job = await waitForJob(uploadResponse.body.jobId);
    expect(job.status).toBe('completed');

    const state = await readRuntimeStateForTests();
    const source = state.productData.dental.sources.find((item) => item.id === uploadResponse.body.sourceId);
    expect(source.metadata?.ocrFallbackUsed).toBe(true);
    expect(source.normalizedPreview).toContain('OCR fallback text');
  });
});
