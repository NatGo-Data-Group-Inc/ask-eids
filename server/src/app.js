import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getRuntimeConfig } from './config/runtime.js';
import { createArtifactStore } from './lib/storage/artifactStore.js';
import { getRetrievalProvider } from './rag/retrievalProvider.js';
import { resetPrototypeDuckDbStore } from './rag/prototypeDuckDbStore.js';
import { buildCorpusDocuments, buildInitialCorpusState } from './services/ingest/corpusImport.service.js';
import { createRuntimeStateRepository } from './services/state/runtimeState.repository.js';
import { HttpError } from './services/common/httpError.js';
import { createReadModelService } from './services/domain/readModel.service.js';
import { createAskService } from './services/domain/ask.service.js';
import { createMutationService, resetMutationHarnessState } from './services/domain/mutation.service.js';

const runtimeConfig = getRuntimeConfig();
const runtimeDir = runtimeConfig.storage.paths.runtimeDir;
const uploadsDir = runtimeConfig.storage.paths.uploadsDir;
const exportsDir = runtimeConfig.storage.paths.exportsDir;
const artifactStore = createArtifactStore({ config: runtimeConfig });
const stateRepository = createRuntimeStateRepository({
  runtimeDir,
  stateDbFile: runtimeConfig.storage.paths.stateDbFile,
  seedStateFactory: buildInitialCorpusState,
});
const upload = multer({ storage: multer.memoryStorage() });

const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  KB_UNAVAILABLE: 'KB_UNAVAILABLE',
  MODEL_TIMEOUT: 'MODEL_TIMEOUT',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT_EVIDENCE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

async function initializeCorpusRuntime() {
  const state = await stateRepository.resetWithSeed();
  await resetPrototypeDuckDbStore();
  if (process.env.EIDS_SKIP_CORPUS_INDEX !== '1') {
    const provider = await getRetrievalProvider();
    await provider.indexDocuments(buildCorpusDocuments(state));
  }
  return state;
}

async function ensureRuntime() {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  await stateRepository.ensureInitialized();
}

export async function resetRuntimeData() {
  await fs.mkdir(runtimeDir, { recursive: true });
  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.mkdir(exportsDir, { recursive: true });
  await fs.rm(runtimeConfig.storage.paths.runtimeFile, { force: true });
  resetMutationHarnessState();
  await initializeCorpusRuntime();
}

export async function resetPrototypeState() {
  await resetRuntimeData();
}

async function readState() {
  return stateRepository.readState();
}

export async function readRuntimeStateForTests() {
  return readState();
}

export async function updateRuntimeStateForTests(mutator) {
  return updateState(mutator);
}

async function writeState(nextState) {
  return stateRepository.writeState(nextState);
}

async function updateState(mutator) {
  return stateRepository.updateState(mutator);
}

const readModel = createReadModelService({ errorCodes: ERROR_CODES });
const askService = createAskService({
  errorCodes: ERROR_CODES,
  runtimeConfig,
  readModel,
});
const mutationService = createMutationService({
  errorCodes: ERROR_CODES,
  readModel,
  readState,
  writeState,
  updateState,
  artifactStore,
  runtimeConfig,
});
let durableJobPumpHandle = null;

function ensureDurableJobPump() {
  if (durableJobPumpHandle) {
    return;
  }
  const intervalMs = Number(process.env.EIDS_JOB_WORKER_INTERVAL_MS || 200);
  durableJobPumpHandle = setInterval(() => {
    mutationService.processPendingJobs().catch((error) => {
      console.warn(`Durable job pump failed: ${error?.message || 'unknown error'}`);
    });
  }, intervalMs);
  if (typeof durableJobPumpHandle.unref === 'function') {
    durableJobPumpHandle.unref();
  }
}

function authMiddleware(req, _res, next) {
  const rolePreset = req.query.asRole || req.headers['x-eids-role'] || 'lead';
  if (!['lead', 'editor', 'read'].includes(rolePreset)) {
    next(new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'Session expired. Sign in again.'));
    return;
  }
  req.user = {
    sub: 'user-123',
    displayName: 'B. Jennings',
    email: 'bjennings@example.mil',
    rolePreset,
  };
  next();
}

function errorHandler(error, _req, res, _next) {
  res.status(error.status || 500).json({
    error: {
      code: error.code || ERROR_CODES.INTERNAL_ERROR,
      message: error.message || 'Something went wrong. Try again.',
      field: error.field || null,
      retryable: error.retryable || false,
      requestId: 'req-local',
    },
  });
}

export async function buildApp({ withVite = false } = {}) {
  await ensureRuntime();
  ensureDurableJobPump();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(authMiddleware);

  app.get('/api/v1/session', async (req, res) => {
    const state = await readState();
    const scopedProductIds = readModel.resolveProductScope(state, req.user.rolePreset);
    res.json({
      user: {
        sub: req.user.sub,
        displayName: req.user.displayName,
        email: req.user.email,
      },
      roles: scopedProductIds.map((productId) => ({ productId, role: req.user.rolePreset })),
    });
  });

  app.get('/api/v1/portfolio', async (_req, res) => {
    const state = await readState();
    res.json(readModel.portfolioPayload(state, _req.user.rolePreset));
  });

  app.get('/api/v1/portfolio/quick-view', async (req, res) => {
    res.json(readModel.quickViewPayload(await readState(), String(req.query.type || 'brief-prep'), req.user.rolePreset));
  });

  app.get('/api/v1/search', async (req, res) => {
    res.json(readModel.searchPayload(await readState(), String(req.query.q || ''), req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId', async (req, res) => {
    res.json(readModel.productPayload(await readState(), req.params.productId, req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId/timeline', async (req, res) => {
    res.json(readModel.timelinePayload(await readState(), req.params.productId, String(req.query.filter || 'all'), req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId/data', async (req, res) => {
    res.json(readModel.dataPayload(await readState(), req.params.productId, String(req.query.dataset || 'risks'), req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId/sources', async (req, res) => {
    res.json(readModel.sourcesPayload(await readState(), req.params.productId, String(req.query.type || 'all'), req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId/sources/:sourceId', async (req, res) => {
    res.json(readModel.sourceDetailPayload(await readState(), req.params.productId, req.params.sourceId, req.user.rolePreset));
  });

  app.get('/api/v1/products/:productId/sources/:sourceId/content', async (req, res) => {
    const state = await readState();
    const data = readModel.getProductDataOrThrow(state, req.params.productId, req.user.rolePreset);
    const source = data.sources.find((item) => item.id === req.params.sourceId);
    const inlineContent = data.sourceContents[req.params.sourceId];
    if (!source && !inlineContent) {
      throw readModel.notFound('Source not found.');
    }
    if (source?.normalizedArtifactKey && await artifactStore.exists({ bucketType: 'normalized', key: source.normalizedArtifactKey })) {
      const content = await artifactStore.readTextArtifact({ bucketType: 'normalized', key: source.normalizedArtifactKey });
      res.type(source.contentType || 'text/plain').send(content);
      return;
    }
    res.type(source?.contentType || 'text/plain').send(inlineContent);
  });

  app.post('/api/v1/products/:productId/ask', async (req, res) => {
    const state = await readState();
    readModel.getProductOrThrow(state, req.params.productId, req.user.rolePreset);
    res.json(await askService.askPayload(await readState(), req.params.productId, req.body.question, {
      testCase: String(req.query.testCase || ''),
      rolePreset: req.user.rolePreset,
    }));
  });

  app.post('/api/v1/products/:productId/transcripts', upload.single('file'), async (req, res) => {
    const state = await readState();
    readModel.getProductOrThrow(state, req.params.productId, req.user.rolePreset);
    const permissions = readModel.getPermissions(state, req.user.rolePreset);
    if (!permissions.canUploadTranscript) {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this product.');
    }
    res.status(202).json(await mutationService.queueTranscriptJob(
      req.params.productId,
      req.file,
      req.body,
      { testCase: String(req.query.testCase || '') }
    ));
  });

  app.post('/api/v1/products/:productId/sources', upload.fields([{ name: 'file', maxCount: 1 }, { name: 'metadataFile', maxCount: 1 }]), async (req, res) => {
    const state = await readState();
    readModel.getProductOrThrow(state, req.params.productId, req.user.rolePreset);
    const permissions = readModel.getPermissions(state, req.user.rolePreset);
    if (!(permissions.canUploadArtifact ?? permissions.canUploadTranscript)) {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to upload artifacts for this product.');
    }
    const file = req.files?.file?.[0] || null;
    const metadataFile = req.files?.metadataFile?.[0] || null;
    res.status(202).json(await mutationService.queueArtifactJob(
      req.params.productId,
      file,
      req.body,
      { testCase: String(req.query.testCase || ''), metadataFile }
    ));
  });

  app.post('/api/v1/products/:productId/weekly-updates', async (req, res) => {
    const state = await readState();
    readModel.getProductOrThrow(state, req.params.productId, req.user.rolePreset);
    const permissions = readModel.getPermissions(state, req.user.rolePreset);
    if (!permissions.canUpdateWeekly) {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this product.');
    }
    res.status(201).json(await mutationService.publishWeeklyUpdate(req.params.productId, req.body, req.user.sub));
  });

  app.post('/api/v1/products/:productId/reports', async (req, res) => {
    readModel.getProductOrThrow(await readState(), req.params.productId, req.user.rolePreset);
    res.status(202).json(await mutationService.queueReportJob(req.params.productId));
  });

  app.get('/api/v1/products/:productId/reports/:reportId', async (req, res) => {
    const state = await readState();
    readModel.getProductOrThrow(state, req.params.productId, req.user.rolePreset);
    const report = state.reports[req.params.reportId];
    const product = state.products.find((item) => item.id === req.params.productId);
    if (!report) {
      throw readModel.notFound('Report not found.');
    }
    res.json({
      ...report,
      requiresRegeneration: Number(report.evidenceVersion || 0) < Number(product?.evidenceVersion || 0),
      regenerateNotice: Number(report.evidenceVersion || 0) < Number(product?.evidenceVersion || 0)
        ? 'New evidence is available. Regenerate to include it.'
        : null,
      sections: (report.sections || []).map((section) => ({
        ...section,
        body: section.bodyCurrent ?? section.body,
        revision: Number.isFinite(section.revision) ? section.revision : 1,
        editedAt: section.editedAt || null,
      })),
    });
  });

  app.patch('/api/v1/products/:productId/reports/:reportId/sections/:sectionId', async (req, res) => {
    readModel.getProductOrThrow(await readState(), req.params.productId, req.user.rolePreset);
    const permissions = readModel.getPermissions(await readState(), req.user.rolePreset);
    res.json(await mutationService.updateReportSection(
      req.params.reportId,
      req.params.sectionId,
      req.body.body,
      permissions.canEditReport,
      req.body.expectedRevision
    ));
  });

  app.post('/api/v1/products/:productId/reports/:reportId/exports', async (req, res) => {
    readModel.getProductOrThrow(await readState(), req.params.productId, req.user.rolePreset);
    res.status(202).json(await mutationService.queueExportJob(
      req.params.productId,
      req.params.reportId,
      req.body.format,
      { testCase: String(req.query.testCase || req.body.testCase || '') }
    ));
  });

  app.post('/api/v1/connectors/mailboxes/sync', async (req, res) => {
    if (req.user.rolePreset === 'read') {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this product.');
    }
    res.status(202).json(await mutationService.queueConnectorSync('mailbox', {
      testCase: String(req.query.testCase || req.body?.testCase || ''),
    }));
  });

  app.post('/api/v1/connectors/ado/sync', async (req, res) => {
    if (req.user.rolePreset === 'read') {
      throw new HttpError(403, ERROR_CODES.FORBIDDEN, 'You do not have access to this product.');
    }
    res.status(202).json(await mutationService.queueConnectorSync('ado', {
      testCase: String(req.query.testCase || req.body?.testCase || ''),
    }));
  });

  app.get('/api/v1/connectors/status', async (_req, res) => {
    res.json(await mutationService.getConnectorStatus());
  });

  app.get('/api/v1/products/:productId/reports/:reportId/exports/:fileName', async (req, res) => {
    readModel.getProductOrThrow(await readState(), req.params.productId, req.user.rolePreset);
    const artifactKey = mutationService.getExportArtifactKey(req.params.productId, req.params.reportId, req.params.fileName);
    const buffer = await artifactStore.readBufferArtifact({ bucketType: 'exports', key: artifactKey });
    res.setHeader('Content-Disposition', `attachment; filename=\"${req.params.fileName}\"`);
    res.type(req.params.fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
    res.send(buffer);
  });

  app.get('/api/v1/jobs/:jobId', async (req, res) => {
    await mutationService.processPendingJobs();
    const state = await readState();
    const job = state.jobs[req.params.jobId];
    if (!job) {
      throw readModel.notFound('Job not found.');
    }
    res.json(job);
  });

  app.post('/api/v1/telemetry', async (req, res) => {
    try {
      await updateState((draft) => {
        if (String(req.query.testCase || '') === 'telemetryWriteFailure') {
          throw new Error('Injected telemetry write failure');
        }
        draft.telemetryEvents = Array.isArray(draft.telemetryEvents) ? draft.telemetryEvents : [];
        draft.telemetryEvents.push(req.body);
        return draft;
      });
    } catch (error) {
      console.warn(`Telemetry persistence failure (non-blocking): ${error?.message || 'unknown error'}`);
    }
    res.status(202).json({ accepted: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/v1/test/reset', async (_req, res) => {
      await resetPrototypeState();
      res.status(204).end();
    });
  }

  if (withVite) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      try {
        const html = await fs.readFile(path.resolve('index.html'), 'utf8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformed);
      } catch (error) {
        next(error);
      }
    });
  }

  app.use(errorHandler);
  return app;
}
