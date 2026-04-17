// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeConfig } from '../src/config/runtime.js';
import { buildApp, readRuntimeStateForTests, resetRuntimeData } from '../src/app.js';
import { normalizeSourceArtifact } from '../src/services/semantic/sourceNormalization.service.js';
import { buildReplayKey, createSemanticReplayStore } from '../src/services/semantic/semanticReplayStore.service.js';

const runtimeConfig = getRuntimeConfig();

const DEFAULT_FEATURE_FLAGS = {
  enableNovaDentalLiveEmail: false,
  enableDentalTrustSurfaces: true,
  enableDentalSemanticServiceSplit: true,
  enableExtractionReplayMode: true,
  enableDentalRetrievalIndexing: true,
};

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

async function resetDentalSemanticState(app, {
  mode = 'wave-00',
  executionMode = 'replay',
  featureFlags = DEFAULT_FEATURE_FLAGS,
  testCase = '',
} = {}) {
  return request(app)
    .post('/api/v1/test/reset')
    .send({
      productId: 'dental',
      mode,
      executionMode,
      featureFlags,
      testCase,
    })
    .expect(200);
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

async function seedReplayEmailArtifact({
  sourceId = 'seed-source',
  productId = 'dental',
  sourceType = 'email',
  title = 'Dental Vendor Mitigation Confirmed',
  sourceDate = '2026-04-16',
  body = sampleEmailBody(),
} = {}) {
  const file = {
    buffer: Buffer.from(body),
    originalname: 'vendor-mitigation-confirmed.eml',
  };
  const normalized = await normalizeSourceArtifact({
    file,
    sourceType,
    sourceId,
    productId,
    title,
    sourceDate,
  });
  const replayStore = createSemanticReplayStore({
    evalCacheDir: runtimeConfig.semantic.evalCacheDir,
  });
  const replayKey = buildReplayKey({
    normalizedPayload: {
      productId: normalized.productId,
      sourceType: normalized.sourceType,
      normalizedText: normalized.normalizedText,
      normalizationVersion: normalized.normalizationVersion,
    },
    promptVersion: runtimeConfig.semantic.promptRegistryVersion,
    modelId: runtimeConfig.bedrock.textModelId,
    sourceFamily: normalized.sourceFamily,
    schemaVersion: 'source-schema-v1',
  });
  const validatedPayload = {
    summary: 'Vendor confirmed staged mitigation.',
    decisions: [
      {
        label: 'Proceed with staged mitigation on April 18',
        confidence: 'high',
        anchorText: 'We can proceed with the staged mitigation on April 18.',
      },
    ],
    warnings: [],
    confidence: 'high',
  };
  await replayStore.writeReplayArtifact({
    replayKey,
    payloadEnvelope: {
      schemaVersion: 'source-schema-v1',
      promptVersion: runtimeConfig.semantic.promptRegistryVersion,
      rawOutputText: JSON.stringify(validatedPayload),
      parsedJson: validatedPayload,
      validatedPayload,
    },
  });
}

describe('semantic ingest integration', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '1';
    await resetRuntimeData();
  });

  it('persists exact-citation email extraction metadata for Dental uploads in hybrid mode', async () => {
    const app = await buildApp();
    await seedReplayEmailArtifact();
    await resetDentalSemanticState(app);

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
    await seedReplayEmailArtifact();
    await resetDentalSemanticState(app);

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

  it('indexes retrieval-eligible Dental uploads immediately and exposes them to Ask without reset', async () => {
    const app = await buildApp();
    await seedReplayEmailArtifact();
    await resetDentalSemanticState(app);

    const upload = await request(app)
      .post('/api/v1/products/dental/sources')
      .field('sourceType', 'email')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Vendor Mitigation Confirmed')
      .attach('file', Buffer.from(sampleEmailBody()), 'vendor-mitigation-confirmed.eml');

    expect(upload.status).toBe(202);

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('completed');

    const sourceDetail = await request(app)
      .get(`/api/v1/products/dental/sources/${upload.body.sourceId}`)
      .expect(200);
    expect(sourceDetail.body.source).toMatchObject({
      sourceFamilyClass: 'retrieval_eligible',
      indexingStatus: 'indexed',
      embeddingSource: expect.stringMatching(/titan|pseudo/),
    });
    expect(sourceDetail.body.source.chunkCount).toBeGreaterThan(0);

    const chunkCount = await request(app)
      .get(`/api/v1/test/rag-chunks/count?sourceId=${encodeURIComponent(upload.body.sourceId)}&productId=dental`)
      .expect(200);
    expect(Number(chunkCount.body.count)).toBeGreaterThan(0);

    const ask = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'What did the vendor confirm?' })
      .expect(200);
    expect(ask.body.sources.some((source) => source.sourceId === upload.body.sourceId && source.retrievalType === 'vector')).toBe(true);
  });

  it('marks retrieval-eligible Dental uploads as disabled when indexing is kill-switched off', async () => {
    const app = await buildApp();
    await seedReplayEmailArtifact();
    await resetDentalSemanticState(app, {
      featureFlags: {
        ...DEFAULT_FEATURE_FLAGS,
        enableDentalRetrievalIndexing: false,
      },
    });

    const upload = await request(app)
      .post('/api/v1/products/dental/sources')
      .field('sourceType', 'email')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Vendor Mitigation Confirmed')
      .attach('file', Buffer.from(sampleEmailBody()), 'vendor-mitigation-confirmed.eml');

    expect(upload.status).toBe(202);

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('completed');

    const sourceDetail = await request(app)
      .get(`/api/v1/products/dental/sources/${upload.body.sourceId}`)
      .expect(200);
    expect(sourceDetail.body.source).toMatchObject({
      sourceFamilyClass: 'retrieval_eligible',
      indexingStatus: 'disabled',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
    });

    const chunkCount = await request(app)
      .get(`/api/v1/test/rag-chunks/count?sourceId=${encodeURIComponent(upload.body.sourceId)}&productId=dental`)
      .expect(200);
    expect(Number(chunkCount.body.count)).toBe(0);

    const ask = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'What did the vendor confirm?' })
      .expect(200);
    expect(ask.body.retrievalWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RETRIEVAL_NOT_READY',
          sourceId: upload.body.sourceId,
          indexingStatus: 'disabled',
        }),
      ])
    );
  });

  it('keeps aggregate publication fresh when indexing fails but marks the source as not retrievable', async () => {
    const app = await buildApp();
    await seedReplayEmailArtifact();
    await resetDentalSemanticState(app);

    const upload = await request(app)
      .post('/api/v1/products/dental/sources?testCase=embeddingFailure')
      .field('sourceType', 'email')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Vendor Mitigation Confirmed')
      .attach('file', Buffer.from(sampleEmailBody()), 'vendor-mitigation-confirmed.eml');

    expect(upload.status).toBe(202);

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('completed');

    const sourceDetail = await request(app)
      .get(`/api/v1/products/dental/sources/${upload.body.sourceId}`)
      .expect(200);
    expect(sourceDetail.body.source).toMatchObject({
      sourceFamilyClass: 'retrieval_eligible',
      indexingStatus: 'failed',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
    });

    const product = await request(app).get('/api/v1/products/dental').expect(200);
    expect(product.body.product.semanticState).toMatchObject({
      freshnessStatus: 'fresh',
      usesLastKnownGood: false,
      showBanner: false,
    });

    const chunkCount = await request(app)
      .get(`/api/v1/test/rag-chunks/count?sourceId=${encodeURIComponent(upload.body.sourceId)}&productId=dental`)
      .expect(200);
    expect(Number(chunkCount.body.count)).toBe(0);

    const ask = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'What did the vendor confirm?' })
      .expect(200);
    expect(ask.body.retrievalWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'RETRIEVAL_NOT_READY',
          sourceId: upload.body.sourceId,
          indexingStatus: 'failed',
        }),
      ])
    );
  });

  it('keeps fixed-schema structured Dental uploads out of rag_chunks while updating deterministic data', async () => {
    const app = await buildApp();
    await resetDentalSemanticState(app);

    const csv = [
      'id,title,severity,status,owner,changed,description,mitigation',
      'risk-100,Vendor mitigation timing risk,high,open,Lowry,2026-04-16,Vendor timing remains tight,Confirm staged mitigation by April 18',
    ].join('\n');

    const upload = await request(app)
      .post('/api/v1/products/dental/sources')
      .field('sourceType', 'risk_export')
      .field('sourceDate', '2026-04-16')
      .field('title', 'Dental Risk Register')
      .field('structuredImpactConfirmed', 'true')
      .attach('file', Buffer.from(csv), 'dental-risk-export.csv');

    expect(upload.status).toBe(202);

    const job = await waitForJob(upload.body.jobId);
    expect(job.status).toBe('completed');

    const sourceDetail = await request(app)
      .get(`/api/v1/products/dental/sources/${upload.body.sourceId}`)
      .expect(200);
    expect(sourceDetail.body.source).toMatchObject({
      sourceType: 'risk_export',
      sourceFamilyClass: 'fixed_schema_structured',
      indexingStatus: 'not_applicable',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
    });

    const chunkCount = await request(app)
      .get(`/api/v1/test/rag-chunks/count?sourceId=${encodeURIComponent(upload.body.sourceId)}&productId=dental`)
      .expect(200);
    expect(Number(chunkCount.body.count)).toBe(0);

    const state = await readRuntimeStateForTests();
    expect(state.productData.dental.lastStructuredImport).toMatchObject({
      sourceId: upload.body.sourceId,
      dataset: 'risks',
      sourceType: 'risk_export',
    });
    expect(state.productData.dental.data.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'risk-100',
          title: 'Vendor mitigation timing risk',
        }),
      ])
    );
  });
});
