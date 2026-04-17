import request from 'supertest';

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function waitForJob(jobId, timeoutMs = 90000) {
  const { readRuntimeStateForTests } = await import('../server/src/app.js');
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = await readRuntimeStateForTests();
    const job = state.jobs[jobId];
    if (job && ['completed', 'partial', 'failed'].includes(job.status)) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for job ${jobId}`);
}

async function main() {
  process.env.VITEST_POOL_ID = process.env.VITEST_POOL_ID || `live-signoff-${Date.now()}`;
  process.env.EIDS_SKIP_CORPUS_INDEX = process.env.EIDS_SKIP_CORPUS_INDEX || '1';
  process.env.EIDS_ENABLE_BEDROCK = process.env.EIDS_ENABLE_BEDROCK || 'true';
  process.env.EIDS_ALLOW_PSEUDO_EMBEDDINGS = 'false';
  process.env.ENABLE_NOVA_DENTAL_LIVE_EMAIL = process.env.ENABLE_NOVA_DENTAL_LIVE_EMAIL || 'true';

  requiredEnv('AWS_REGION');
  requiredEnv('BEDROCK_TEXT_MODEL_ID');
  requiredEnv('BEDROCK_EMBED_MODEL_ID');

  const { buildApp, resetRuntimeData } = await import('../server/src/app.js');
  await resetRuntimeData();
  const app = await buildApp();

  const resetResponse = await request(app)
    .post('/api/v1/test/reset')
    .send({
      productId: 'dental',
      mode: 'wave-00',
      executionMode: 'live',
      featureFlags: {
        enableNovaDentalLiveEmail: true,
        enableDentalTrustSurfaces: true,
        enableSemanticServicePath: true,
        enableExtractionReplayMode: false,
        enableDentalRetrievalIndexing: true,
      },
    });

  if (resetResponse.status !== 200) {
    throw new Error(`Reset failed: ${resetResponse.status} ${JSON.stringify(resetResponse.body)}`);
  }

  const email = [
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

  const uploadResponse = await request(app)
    .post('/api/v1/products/dental/sources')
    .field('sourceType', 'email')
    .field('sourceDate', '2026-04-16')
    .field('title', 'Dental Vendor Mitigation Confirmed')
    .attach('file', Buffer.from(email), 'vendor-mitigation-confirmed.eml');

  if (uploadResponse.status !== 202) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${JSON.stringify(uploadResponse.body)}`);
  }

  const job = await waitForJob(uploadResponse.body.jobId);
  if (job.status !== 'completed') {
    throw new Error(`Live provider signoff job did not complete: ${JSON.stringify(job)}`);
  }

  const productResponse = await request(app).get('/api/v1/products/dental');
  const sourceResponse = await request(app).get(`/api/v1/products/dental/sources/${uploadResponse.body.sourceId}`);
  const ragResponse = await request(app).get(`/api/v1/test/rag-chunks/count?sourceId=${encodeURIComponent(uploadResponse.body.sourceId)}&productId=dental`);
  const askResponse = await request(app)
    .post('/api/v1/products/dental/ask')
    .send({ question: 'What did the vendor confirm?' });
  const reportResponse = await request(app).get('/api/v1/products/dental/reports/rep-seeded');

  const source = sourceResponse.body.source;
  const productSemanticState = productResponse.body.product.semanticState;
  const reportSemanticState = reportResponse.body.semanticState;
  const ragCount = Number(ragResponse.body.count || 0);
  const askSources = askResponse.body.sources || [];

  if (source.executionMode !== 'live') {
    throw new Error(`Expected live execution mode, received ${source.executionMode}`);
  }
  if (source.embeddingSource !== 'titan') {
    throw new Error(`Expected titan embeddings, received ${source.embeddingSource}`);
  }
  if (source.indexingStatus !== 'indexed') {
    throw new Error(`Expected indexingStatus=indexed, received ${source.indexingStatus}`);
  }
  if (ragCount < 1) {
    throw new Error(`Expected rag_chunks count >= 1, received ${ragCount}`);
  }
  if (!askSources.some((item) => item.sourceId === uploadResponse.body.sourceId && item.retrievalType === 'vector')) {
    throw new Error('Expected Ask to cite the newly uploaded source via vector retrieval.');
  }
  if (productSemanticState.freshnessStatus !== 'fresh' || productSemanticState.showBanner !== false) {
    throw new Error(`Expected fresh published product semantic state, received ${JSON.stringify(productSemanticState)}`);
  }
  if (reportSemanticState.showBanner !== false) {
    throw new Error(`Expected fresh report state without banner, received ${JSON.stringify(reportSemanticState)}`);
  }

  console.log(JSON.stringify({
    status: 'ok',
    reset: resetResponse.body,
    upload: uploadResponse.body,
    job,
    productSemanticState,
    source,
    ragCount,
    ask: {
      status: askResponse.body.status,
      sources: askSources,
      retrievalWarnings: askResponse.body.retrievalWarnings,
      semanticState: askResponse.body.semanticState,
    },
    reportSemanticState,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
