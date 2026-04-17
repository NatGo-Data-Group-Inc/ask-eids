import path from 'node:path';
import { generateBedrockText } from '../../lib/aws/bedrockText.js';
import { attachSemanticStateToRuntimeState, buildCorpusReport, buildStructuredRows, buildUploadedCorpusEntry, deriveCorpusProductState } from '../ingest/corpusImport.service.js';
import { HttpError } from '../common/httpError.js';
import { normalizeTranscriptUpload } from '../ingest/normalize/transcriptNormalizer.js';
import { extractTranscriptEntities } from '../extract/transcriptExtraction.service.js';
import { buildChunkArtifacts } from '../rag/chunking.service.js';
import { buildMailboxSyncDelta } from '../connectors/mailboxConnector.service.js';
import { buildAdoSyncDelta } from '../connectors/adoConnector.service.js';
import { runAdoMcpEnrichment } from '../connectors/adoMcpAdapter.service.js';
import { resolveSemanticExecutionPolicy } from '../semantic/executionPolicy.service.js';
import { runSemanticIngest } from '../semantic/semanticIngestOrchestrator.service.js';
import { runChunkingAndIndexing } from '../semantic/chunkingAndIndexing.service.js';
import {
  appendProductAggregateAttempt,
  buildPublicationGuard,
  createAggregatePublicationRun,
  buildEmailSemanticState,
  ensureSemanticCollections,
  replaceProductAggregateWithGuard,
  upsertPromptRun,
  upsertSourceExtraction,
} from '../semantic/semanticPublication.service.js';
import { validateAggregatePayload } from '../semantic/aggregateValidation.service.js';
import { extractAggregateWithNova } from '../semantic/novaAggregateExtraction.service.js';
import { resolveEffectiveFeatureFlags } from '../semantic/featureFlags.service.js';
import {
  buildSourceSummary,
  buildTestSourceId,
  extractArtifactContent,
  parseStructuredImportRows,
  validateArtifactUpload,
} from '../ingest/artifactUpload.service.js';
import { getSourceFamilyClass, getSourceTypeDefinition, isStructuredImportType } from '../../../../shared/artifactTypes.js';

const artifactUploadFailureAttempts = new Map();

function sortProductsByStatusAndHealth(products = []) {
  const rank = { risk: 0, caution: 1, healthy: 2 };
  return [...products].sort((left, right) => {
    const statusDiff = (rank[left.status] ?? 99) - (rank[right.status] ?? 99);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return Number(right.health?.overall || 0) - Number(left.health?.overall || 0);
  });
}

function sameCorpusEntry(left, right) {
  return left?.title === right?.title
    && left?.sourceType === right?.sourceType
    && left?.documentDate === right?.documentDate;
}

function getCorpusMetadataAttributes(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  return metadata.metadataAttributes && typeof metadata.metadataAttributes === 'object'
    ? metadata.metadataAttributes
    : null;
}

export function resetMutationHarnessState() {
  artifactUploadFailureAttempts.clear();
}

function artifactKeyForSource(productId, sourceId, fileName) {
  return path.posix.join(productId, 'sources', sourceId, fileName);
}

function artifactKeyForExport(productId, reportId, fileName) {
  return path.posix.join(productId, 'reports', reportId, fileName);
}

function appendAuditEvent(draft, { actorSub = 'system', productId = null, action, targetType, targetId, payload = {} }) {
  draft.auditEvents = Array.isArray(draft.auditEvents) ? draft.auditEvents : [];
  draft.auditEvents.push({
    auditEventId: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actorSub,
    productId,
    action,
    targetType,
    targetId,
    payload,
    occurredAt: new Date().toISOString(),
  });
}

function minimalPdf(title, body) {
  const safeTitle = title.replace(/[()]/g, '');
  const safeBody = body.replace(/[()]/g, '');
  return `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 86>>stream\nBT /F1 18 Tf 72 720 Td (${safeTitle}) Tj 0 -28 Td (${safeBody}) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000110 00000 n \n0000000236 00000 n \n0000000374 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n444\n%%EOF`;
}

async function indexTranscriptEvidence({
  runtimeConfig,
  productId,
  sourceId,
  sourceType,
  sourceFamilyClass = 'retrieval_eligible',
  sourceDate,
  title,
  author,
  participants = [],
  normalizedText,
  featureFlags,
  testCase = '',
}) {
  return runChunkingAndIndexing({
    runtimeConfig,
    productId,
    sourceId,
    sourceType,
    sourceFamilyClass,
    sourceDate,
    title,
    author,
    participants,
    normalizedText,
    featureFlags,
    testCase,
  });
}

function nowDateLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function nowIso() {
  return new Date().toISOString();
}

function currentPublishedAggregateForProduct(draft, productId) {
  return draft.productAggregates?.find((item) => item.productId === productId && item.published) || null;
}

function currentAggregateGuardForProduct(state, productId) {
  const published = state.productAggregates?.find((item) => item.productId === productId && item.published) || null;
  if (published) {
    return buildPublicationGuard(published);
  }

  const product = state.products?.find((item) => item.id === productId) || null;
  const productData = state.productData?.[productId] || null;
  const aggregateVersion = Number(product?.semanticState?.aggregateVersion || product?.evidenceVersion || productData?.evidenceVersion || 0);
  return {
    aggregateId: product?.semanticState?.aggregateId || null,
    aggregateVersion,
    evidenceVersion: aggregateVersion,
    sourceSetHash: null,
  };
}

function parseAttendees(input) {
  return Array.isArray(input)
    ? input.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 20)
    : input
      ? String(input).split(',').map((item) => item.trim()).filter(Boolean).slice(0, 20)
      : [];
}

function validateTranscriptPayload({ body, file, errorCodes }) {
  const meetingTitle = String(body.meetingTitle || '').trim();
  const meetingDate = String(body.meetingDate || '').trim();
  if (!meetingTitle) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Enter a meeting title', { field: 'meetingTitle' });
  }
  if (!meetingDate) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose a meeting date', { field: 'meetingDate' });
  }
  const meetingDateValue = new Date(`${meetingDate}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!Number.isNaN(meetingDateValue.getTime()) && meetingDateValue.getTime() > todayUtc.getTime()) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Meeting date cannot be in the future', { field: 'meetingDate' });
  }
  if (!file) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose a transcript file', { field: 'file' });
  }
  if (!['.txt', '.docx', '.pdf', '.vtt', '.md'].some((extension) => file.originalname.toLowerCase().endsWith(extension))) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'File type not supported', { field: 'file' });
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new HttpError(413, errorCodes.PAYLOAD_TOO_LARGE, 'File exceeds 25MB limit', { field: 'file' });
  }
}

async function maybeDraftReport(report, product) {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return { ...report, generationProvider: 'local' };
  }

  try {
    const draftedSections = [];
    for (const section of report.sections) {
      const draftedBody = await generateBedrockText({
        systemPrompt: 'You are drafting an evidence-backed internal product report section. Use only the supplied draft text and preserve the meaning. Return plain text only.',
        promptText: [
          `Product: ${product.name}`,
          `Section: ${section.title}`,
          `Coverage warning: ${report.coverage?.warningText || 'None'}`,
          'Deterministic draft:',
          section.bodyCurrent ?? section.body,
          'Rewrite the draft into concise executive-ready text without inventing facts.',
        ].join('\n\n'),
        maxTokens: 700,
        temperature: 0.1,
      });
      draftedSections.push({
        ...section,
        bodyCurrent: draftedBody || section.bodyCurrent || section.body,
      });
    }
    return {
      ...report,
      sections: draftedSections,
      generationProvider: 'bedrock',
    };
  } catch {
    return { ...report, generationProvider: 'local' };
  }
}

export function createMutationService({
  errorCodes,
  readModel,
  readState,
  updateState,
  artifactStore,
  runtimeConfig,
}) {
  let jobPumpRunning = false;

  function syncSemanticState(draft) {
    const effectiveFeatureFlags = resolveEffectiveFeatureFlags({
      runtimeConfig,
      persistedSemanticConfig: draft.semanticConfig,
    });
    return attachSemanticStateToRuntimeState(draft, {
      featureMode: draft.semanticConfig?.featureMode || (runtimeConfig?.features?.enableNovaDentalExtraction ? 'extraction-first' : 'legacy'),
      featureFlags: effectiveFeatureFlags,
      executionMode: draft.semanticConfig?.executionMode || runtimeConfig?.semantic?.extractionExecutionMode || 'replay',
      promptVersion: draft.semanticConfig?.promptVersion || runtimeConfig?.semantic?.promptRegistryVersion || 'local-dev',
      modelId: draft.semanticConfig?.modelId || runtimeConfig?.bedrock?.textModelId || 'amazon.nova-pro-v1:0',
      liveSourceFamilies: Object.entries(draft.semanticConfig?.sourceFamilyModes || {})
        .filter(([, mode]) => mode === 'live')
        .map(([family]) => family)
        .filter(Boolean).length
        ? Object.entries(draft.semanticConfig?.sourceFamilyModes || {})
          .filter(([, mode]) => mode === 'live')
          .map(([family]) => family)
        : (runtimeConfig?.semantic?.liveSourceFamilies || ['email']),
      staleAfterHours: draft.semanticConfig?.staleAfterHours || runtimeConfig?.semantic?.staleAfterHours || 24,
    });
  }

  async function markJobCompleted(jobId, result, postMutate) {
    await updateState((draft) => {
      if (typeof postMutate === 'function') {
        postMutate(draft);
      }
      const job = draft.jobs[jobId];
      if (!job) {
        return draft;
      }
      draft.jobs[jobId] = {
        ...job,
        status: 'completed',
        result,
        updatedAt: nowIso(),
        lockedAt: null,
      };
      return draft;
    });
  }

  async function markJobFailed(jobId, error, retryable = true, postMutate) {
    await updateState((draft) => {
      if (typeof postMutate === 'function') {
        postMutate(draft);
      }
      const job = draft.jobs[jobId];
      if (!job) {
        return draft;
      }
      draft.jobs[jobId] = {
        ...job,
        status: 'failed',
        errorCode: errorCodes.INTERNAL_ERROR,
        message: error?.message || 'Job failed',
        retryable,
        updatedAt: nowIso(),
        lockedAt: null,
      };
      return draft;
    });
  }

  async function claimNextDurableJob() {
    let claimed = null;
    await updateState((draft) => {
      const eligibleJobs = Object.values(draft.jobs || {})
        .filter((job) => ['report', 'export', 'connector-sync'].includes(job.jobType))
        .filter((job) => ['pending', 'running'].includes(job.status))
        .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));
      if (!eligibleJobs.length) {
        return draft;
      }

      const candidate = eligibleJobs[0];
      const currentJob = draft.jobs[candidate.jobId];
      if (!currentJob || !['pending', 'running'].includes(currentJob.status)) {
        return draft;
      }

      const lockAgeMs = currentJob.lockedAt ? Date.now() - new Date(currentJob.lockedAt).getTime() : Number.POSITIVE_INFINITY;
      if (currentJob.status === 'running' && lockAgeMs < 3000) {
        return draft;
      }

      const updatedJob = {
        ...currentJob,
        status: 'running',
        startedAt: currentJob.startedAt || nowIso(),
        attempts: Number(currentJob.attempts || 0) + 1,
        updatedAt: nowIso(),
        lockedAt: nowIso(),
      };
      draft.jobs[currentJob.jobId] = updatedJob;
      claimed = structuredClone(updatedJob);
      return draft;
    });
    return claimed;
  }

  async function processReportJob(job) {
    const payload = job.payload || {};
    if (payload.testCase === 'reportFailure') {
      throw new Error('Injected report generation failure');
    }

    const current = await readState();
    const product = readModel.getProductOrThrow(current, payload.productId);
    const builtReport = buildCorpusReport(current, payload.productId);
    const reportWithBodies = {
      ...builtReport,
      evidenceVersion: Number(product.evidenceVersion || current.productData[payload.productId]?.evidenceVersion || 1),
      sections: builtReport.sections.map((section) => ({
        ...section,
        bodyGenerated: section.body,
        bodyCurrent: section.body,
        body: section.body,
        revision: 1,
        editedAt: null,
      })),
    };
    const draftedReport = await maybeDraftReport(reportWithBodies, product);

    await markJobCompleted(job.jobId, { reportId: payload.reportId, provider: draftedReport.generationProvider || 'local' }, (draft) => {
      draft.reports[payload.reportId] = { reportId: payload.reportId, productId: payload.productId, ...draftedReport };
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: payload.productId,
        action: 'report.generated',
        targetType: 'report',
        targetId: payload.reportId,
        payload: { jobId: job.jobId, provider: draftedReport.generationProvider || 'local' },
      });
    });
  }

  async function processExportJob(job) {
    const payload = job.payload || {};
    const current = await readState();
    const report = current.reports[payload.reportId];
    if (!report) {
      throw new Error('Report not found for export');
    }
    if (payload.testCase === 'exportFailure') {
      throw new Error('Injected export failure');
    }

    const fileName = `${payload.productId}-${payload.reportId}.${payload.format === 'copy' ? 'txt' : payload.format}`;
    const artifactKey = artifactKeyForExport(payload.productId, payload.reportId, fileName);
    const [first] = report.sections || [];

    if (payload.format === 'pdf') {
      await artifactStore.writeTextArtifact({
        bucketType: 'exports',
        key: artifactKey,
        content: minimalPdf(first?.title || 'Report Export', (first?.bodyCurrent ?? first?.body ?? '').slice(0, 500)),
        contentType: 'application/pdf',
      });
    } else {
      await artifactStore.writeTextArtifact({
        bucketType: 'exports',
        key: artifactKey,
        content: (report.sections || []).map((section) => `${section.title}\n${section.bodyCurrent ?? section.body}`).join('\n\n'),
        contentType: payload.format === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'text/plain; charset=utf-8',
      });
    }

    await markJobCompleted(job.jobId, {
      reportId: payload.reportId,
      format: payload.format,
      fileName,
      artifactKey,
      downloadUrl: `/api/v1/products/${payload.productId}/reports/${payload.reportId}/exports/${fileName}`,
    }, (draft) => {
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: payload.productId,
        action: 'export.completed',
        targetType: 'report',
        targetId: payload.reportId,
        payload: { format: payload.format, jobId: job.jobId },
      });
    });
  }

  function ensureConnectorState(draft) {
    draft.connectorProfiles = draft.connectorProfiles && typeof draft.connectorProfiles === 'object'
      ? draft.connectorProfiles
      : {};
    draft.syncRuns = Array.isArray(draft.syncRuns) ? draft.syncRuns : [];
    draft.nextIds = draft.nextIds && typeof draft.nextIds === 'object' ? draft.nextIds : {};
    if (!Number.isFinite(Number(draft.nextIds.syncRun))) {
      draft.nextIds.syncRun = 1;
    }
  }

  function appendSyncRun(draft, payload) {
    ensureConnectorState(draft);
    const syncRunId = `sync-${draft.nextIds.syncRun++}`;
    draft.syncRuns.unshift({
      syncRunId,
      ...payload,
    });
    return syncRunId;
  }

  function appendTimelineEntries(draft, productId, entries, isoDate) {
    if (!entries?.length) {
      return;
    }
    const groups = draft.productData?.[productId]?.timelineGroups;
    if (!Array.isArray(groups)) {
      return;
    }
    const dateLabel = new Date(isoDate || nowIso()).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const existingGroup = groups.find((group) => group.dateLabel === dateLabel);
    if (existingGroup) {
      existingGroup.entries = [...entries, ...existingGroup.entries];
      return;
    }
    groups.unshift({ dateLabel, entries: [...entries] });
  }

  function connectorProfilesForType(draft, connectorType) {
    ensureConnectorState(draft);
    return Object.values(draft.connectorProfiles)
      .filter((profile) => profile.enabled !== false)
      .filter((profile) => {
        if (connectorType === 'mailbox') return profile.connectorType === 'mailbox';
        if (connectorType === 'ado') return profile.connectorType === 'ado-rest';
        return false;
      });
  }

  function syncRunConnectorType(connectorType) {
    if (connectorType === 'mailbox') {
      return 'mailbox';
    }
    if (connectorType === 'ado') {
      return 'ado-rest';
    }
    return connectorType;
  }

  function assertConnectorTypeOrThrow(connectorType) {
    if (!['mailbox', 'ado'].includes(connectorType)) {
      throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Unsupported connector type.');
    }
  }

  async function processMailboxConnectorJob(job) {
    const payload = job.payload || {};
    const syncRunIds = [];
    const aggregate = {
      connectorType: 'mailbox',
      profiles: 0,
      messagesIngested: 0,
      attachmentsIngested: 0,
      duplicatesSuppressed: 0,
    };

    await markJobCompleted(job.jobId, { connectorType: 'mailbox', syncRunIds }, (draft) => {
      const profiles = connectorProfilesForType(draft, 'mailbox');
      if (!profiles.length) {
        throw new Error('No enabled mailbox connector profile found.');
      }
      aggregate.profiles = profiles.length;

      for (const profile of profiles) {
        const productData = draft.productData[profile.productId];
        if (!productData) {
          continue;
        }
        const delta = buildMailboxSyncDelta({
          profile,
          existingSources: productData.sources,
          nextSourceId: Number(draft.nextIds.source || 1),
          testCase: payload.testCase || '',
        });

        draft.nextIds.source = delta.nextSourceId;
        for (const source of [...delta.newSources].reverse()) {
          productData.sources.unshift(source);
        }
        productData.sourceContents = {
          ...(productData.sourceContents || {}),
          ...delta.sourceContents,
        };
        appendTimelineEntries(draft, profile.productId, delta.timelineEntries, nowIso());

        profile.lastCursor = delta.nextCursor;
        profile.lastRunAt = nowIso();
        profile.consecutiveFailures = 0;

        aggregate.messagesIngested += delta.metrics.messagesIngested;
        aggregate.attachmentsIngested += delta.metrics.attachmentsIngested;
        aggregate.duplicatesSuppressed += delta.metrics.duplicatesSuppressed;

        const syncRunId = appendSyncRun(draft, {
          connectorProfileId: profile.connectorProfileId,
          connectorType: profile.connectorType,
          status: 'completed',
          startedAt: nowIso(),
          endedAt: nowIso(),
          metrics: delta.metrics,
          errorCode: null,
          errorMessage: null,
        });
        syncRunIds.push(syncRunId);
      }
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: profiles[0]?.productId || null,
        action: 'connector.mailbox_synced',
        targetType: 'connector',
        targetId: 'mailbox',
        payload: aggregate,
      });
    });
  }

  async function processAdoConnectorJob(job) {
    const payload = job.payload || {};
    const syncRunIds = [];
    const aggregate = {
      connectorType: 'ado',
      profiles: 0,
      changedItems: 0,
      inserted: 0,
      updated: 0,
      mcpStatus: 'disabled',
      mcpWarning: null,
    };

    await markJobCompleted(job.jobId, { connectorType: 'ado', syncRunIds }, (draft) => {
      const profiles = connectorProfilesForType(draft, 'ado');
      if (!profiles.length) {
        throw new Error('No enabled ADO REST connector profile found.');
      }
      aggregate.profiles = profiles.length;

      for (const profile of profiles) {
        const productData = draft.productData[profile.productId];
        if (!productData) {
          continue;
        }
        const delta = buildAdoSyncDelta({
          profile,
          currentData: productData.data,
          testCase: payload.testCase || '',
        });
        productData.data = delta.nextData;
        profile.watermark = delta.nextWatermark || profile.watermark || null;
        profile.lastRunAt = nowIso();
        profile.consecutiveFailures = 0;

        const sourceId = `src-${draft.nextIds.source++}`;
        const sourceTitle = `ADO Sync (${delta.metrics.changedItems} changed)`;
        productData.sources.unshift({
          id: sourceId,
          type: 'ado',
          sourceSubtype: 'connector-ado-rest',
          externalRef: `ado-sync-${sourceId}`,
          title: sourceTitle,
          date: (delta.summary.date || nowIso()).split('T')[0],
          meta: 'ADO REST connector sync',
          previewText: delta.summary.detail,
          author: 'ado-rest-connector',
          participants: [],
          contentType: 'application/json',
          metadata: {
            watermark: profile.watermark,
            changedItems: delta.metrics.changedItems,
          },
          openable: true,
        });
        productData.sourceContents[sourceId] = JSON.stringify(delta.nextData, null, 2);
        appendTimelineEntries(draft, profile.productId, [{
          id: `evt-${sourceId}`,
          type: 'ado',
          timeLabel: new Date(delta.summary.date || nowIso()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          title: sourceTitle,
          detail: delta.summary.detail,
          sourceRef: { sourceId, label: sourceTitle },
        }], delta.summary.date || nowIso());

        aggregate.changedItems += delta.metrics.changedItems;
        aggregate.inserted += delta.metrics.inserted;
        aggregate.updated += delta.metrics.updated;

        const syncRunId = appendSyncRun(draft, {
          connectorProfileId: profile.connectorProfileId,
          connectorType: profile.connectorType,
          status: 'completed',
          startedAt: nowIso(),
          endedAt: nowIso(),
          metrics: delta.metrics,
          errorCode: null,
          errorMessage: null,
        });
        syncRunIds.push(syncRunId);
      }

      try {
        const enrichment = runAdoMcpEnrichment({
          enabled: Boolean(runtimeConfig?.connectors?.enableAdoMcpEnrichment),
          testCase: payload.testCase || '',
        });
        aggregate.mcpStatus = enrichment.status;
      } catch (error) {
        aggregate.mcpStatus = 'failed';
        aggregate.mcpWarning = error.message;
      }

      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: profiles[0]?.productId || null,
        action: 'connector.ado_synced',
        targetType: 'connector',
        targetId: 'ado',
        payload: aggregate,
      });
    });
  }

  async function processConnectorJob(job) {
    const connectorType = job.payload?.connectorType;
    if (connectorType === 'mailbox') {
      await processMailboxConnectorJob(job);
      return;
    }
    if (connectorType === 'ado') {
      await processAdoConnectorJob(job);
      return;
    }
    throw new Error(`Unsupported connector type: ${connectorType || 'unknown'}`);
  }

  async function processPendingJobs() {
    if (jobPumpRunning) {
      return;
    }
    jobPumpRunning = true;
    try {
      for (let index = 0; index < 3; index += 1) {
        const job = await claimNextDurableJob();
        if (!job) {
          break;
        }
        try {
          if (job.jobType === 'report') {
            await processReportJob(job);
          } else if (job.jobType === 'export') {
            await processExportJob(job);
          } else if (job.jobType === 'connector-sync') {
            await processConnectorJob(job);
          }
        } catch (error) {
          await markJobFailed(job.jobId, error, true, (draft) => {
            if (job.jobType === 'report') {
              appendAuditEvent(draft, {
                actorSub: draft.session?.user?.sub || 'user-123',
                productId: job.payload?.productId || null,
                action: 'report.failed',
                targetType: 'report',
                targetId: job.payload?.reportId || null,
                payload: { jobId: job.jobId, message: error.message },
              });
            }
            if (job.jobType === 'export') {
              appendAuditEvent(draft, {
                actorSub: draft.session?.user?.sub || 'user-123',
                productId: job.payload?.productId || null,
                action: 'export.failed',
                targetType: 'report',
                targetId: job.payload?.reportId || null,
                payload: { jobId: job.jobId, format: job.payload?.format, message: error.message },
              });
            }
            if (job.jobType === 'connector-sync') {
              const connectorType = job.payload?.connectorType;
              const profiles = connectorProfilesForType(draft, connectorType);
              const startedAt = job.startedAt || nowIso();
              const endedAt = nowIso();
              for (const profile of profiles) {
                profile.consecutiveFailures = Number(profile.consecutiveFailures || 0) + 1;
                profile.lastRunAt = endedAt;
                appendSyncRun(draft, {
                  connectorProfileId: profile.connectorProfileId,
                  connectorType: profile.connectorType,
                  status: 'failed',
                  startedAt,
                  endedAt,
                  metrics: {},
                  errorCode: errorCodes.INTERNAL_ERROR,
                  errorMessage: error.message,
                });
              }
              appendAuditEvent(draft, {
                actorSub: draft.session?.user?.sub || 'user-123',
                productId: profiles[0]?.productId || null,
                action: 'connector.sync_failed',
                targetType: 'connector',
                targetId: connectorType || 'unknown',
                payload: {
                  jobId: job.jobId,
                  connectorType: connectorType || 'unknown',
                  profileCount: profiles.length,
                  message: error.message,
                },
              });
            }
          });
        }
      }
    } finally {
      jobPumpRunning = false;
    }
  }

  async function queueTranscriptJob(productId, file, body, options = {}) {
    validateTranscriptPayload({ body, file, errorCodes });
    const state = await readState();
    const effectiveFeatureFlags = resolveEffectiveFeatureFlags({
      runtimeConfig,
      persistedSemanticConfig: state.semanticConfig,
    });
    const sourceFamilyClass = getSourceFamilyClass('transcript');
    const sourceId = `src-${state.nextIds.source++}`;
    const jobId = `job-${state.nextIds.job++}`;
    const attendees = parseAttendees(body.attendees);
    const rawArtifactKey = artifactKeyForSource(productId, sourceId, file.originalname);
    const normalizedArtifactKey = artifactKeyForSource(productId, sourceId, 'normalized.md');
    await artifactStore.writeBufferArtifact({ bucketType: 'raw', key: rawArtifactKey, buffer: file.buffer, contentType: file.mimetype || 'application/octet-stream' });

    await updateState((draft) => {
      draft.nextIds.source = state.nextIds.source;
      draft.nextIds.job = state.nextIds.job;
      draft.jobs[jobId] = { jobId, jobType: 'ingest', productId, status: 'queued', result: { sourceId } };
      const data = draft.productData[productId];
      data.sources.unshift({
        id: sourceId,
        type: 'transcript',
        sourceType: 'transcript',
        sourceFamilyClass,
        title: body.meetingTitle,
        date: body.meetingDate,
        meta: `${attendees.length} attendees · Upload queued`,
        previewText: 'Transcript upload queued.',
        author: draft.session.user.displayName,
        participants: attendees,
        contentType: file.mimetype || 'text/plain',
        rawArtifactKey,
        normalizedArtifactKey,
        ingestStatus: 'pending',
        indexed: false,
        indexingStatus: effectiveFeatureFlags.enableDentalRetrievalIndexing ? 'queued' : 'disabled',
        chunkCount: 0,
        embeddingDims: null,
        embeddingSource: 'none',
        chunkArtifacts: [],
        extracted: { decisions: [], actionItems: [], stakeholders: attendees },
        summary: 'Transcript upload queued.',
        citations: [],
        confidence: 'low',
        warnings: [],
        metadata: {},
        openable: true,
      });
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId,
        action: 'transcript.upload_queued',
        targetType: 'source',
        targetId: sourceId,
        payload: { jobId, meetingTitle: body.meetingTitle, meetingDate: body.meetingDate },
      });
      return draft;
    });

    setTimeout(async () => {
      try {
        await updateState((draft) => {
          draft.jobs[jobId] = { jobId, jobType: 'ingest', productId, status: 'running', result: { sourceId } };
          const source = draft.productData[productId].sources.find((item) => item.id === sourceId);
          if (source) {
            source.ingestStatus = 'processing';
          }
          return draft;
        });

        const normalized = await normalizeTranscriptUpload({
          file,
          meetingTitle: body.meetingTitle,
          meetingDate: body.meetingDate,
          attendees,
          notes: body.notes || '',
          runtimeConfig,
          testCase: options.testCase || '',
        });
        await artifactStore.writeTextArtifact({
          bucketType: 'normalized',
          key: normalizedArtifactKey,
          content: normalized.normalizedText,
          contentType: 'text/markdown; charset=utf-8',
        });

        const chunkArtifacts = buildChunkArtifacts({
          productId,
          sourceId,
          sourceType: 'transcript',
          sourceDate: body.meetingDate,
          title: body.meetingTitle,
          author: state.session.user.displayName,
          participants: attendees,
          text: normalized.normalizedText,
        });

        for (const chunk of chunkArtifacts) {
          await artifactStore.writeTextArtifact({
            bucketType: 'normalized',
            key: chunk.chunkKey,
            content: chunk.chunkText,
            contentType: 'text/markdown; charset=utf-8',
          });
          await artifactStore.writeTextArtifact({
            bucketType: 'normalized',
            key: chunk.metadataKey,
            content: JSON.stringify(chunk.metadata, null, 2),
            contentType: 'application/json; charset=utf-8',
          });
        }

        let extraction = { decisions: [], actionItems: [], stakeholders: attendees };
        let extractionFailed = false;
        try {
          extraction = extractTranscriptEntities({
            transcriptText: normalized.normalizedText,
            testCase: options.testCase || '',
          });
        } catch {
          extractionFailed = true;
        }

        const indexingResult = await indexTranscriptEvidence({
          runtimeConfig,
          productId,
          sourceId,
          sourceType: 'transcript',
          sourceFamilyClass,
          sourceDate: body.meetingDate,
          title: body.meetingTitle,
          author: state.session.user.displayName,
          participants: attendees,
          normalizedText: normalized.normalizedText,
          featureFlags: effectiveFeatureFlags,
          testCase: options.testCase || '',
        });

        await updateState((draft) => {
          const product = draft.products.find((item) => item.id === productId);
          const data = draft.productData[productId];
          const source = data.sources.find((item) => item.id === sourceId);
          if (source) {
            source.meta = `${attendees.length} attendees · Uploaded transcript`;
            source.previewText = normalized.normalizedPreview;
            source.normalizedPreview = normalized.normalizedPreview;
            source.normalizedArtifactKey = normalizedArtifactKey;
            source.chunkArtifacts = chunkArtifacts.map((chunk) => ({
              chunkIndex: chunk.chunkIndex,
              chunkKey: chunk.chunkKey,
              metadataKey: chunk.metadataKey,
              tokenCount: chunk.tokenCount,
            }));
            source.metadata = normalized.metadata;
            source.extracted = extraction;
            source.indexed = indexingResult.indexingStatus === 'indexed';
            source.indexingStatus = indexingResult.indexingStatus;
            source.chunkCount = indexingResult.chunkCount;
            source.embeddingDims = indexingResult.embeddingDims;
            source.embeddingSource = indexingResult.embeddingSource;
            source.ingestStatus = extractionFailed ? 'partial' : 'completed';
            source.summary = normalized.normalizedPreview;
            source.citations = [{
              kind: 'line_range',
              start: 1,
              end: Math.max(1, Math.min(normalized.normalizedText.split(/\r?\n/).filter(Boolean).length, 4)),
              label: `Lines 1-${Math.max(1, Math.min(normalized.normalizedText.split(/\r?\n/).filter(Boolean).length, 4))}`,
            }];
            source.confidence = extractionFailed ? 'medium' : 'high';
            source.warnings = extractionFailed ? ['We could not validate AI extraction for this source. Your previous product state is still active.'] : [];
            source.warningText = extractionFailed ? 'We could not validate AI extraction for this source. Your previous product state is still active.' : null;
          }
          data.sourceContents[sourceId] = normalized.normalizedText;
          product.health.coverage = Math.min(100, product.health.coverage + 4);
          product.health.overall = Math.min(100, product.health.overall + 2);
          product.highlights = product.highlights.filter((item) => !item.text.toLowerCase().includes('transcript'));
          product.recentSignals.unshift({ id: `sig-${Date.now()}`, dateLabel: nowDateLabel(), type: 'transcript', title: `${body.meetingTitle} transcript uploaded` });
          draft.jobs[jobId] = {
            jobId,
            jobType: 'ingest',
            productId,
            status: extractionFailed ? 'partial' : 'completed',
            result: { sourceId },
          };
          return syncSemanticState(draft);
        });
      } catch (error) {
        await updateState((draft) => {
          const source = draft.productData[productId].sources.find((item) => item.id === sourceId);
          if (source) {
            source.ingestStatus = 'failed';
            source.indexed = false;
            source.confidence = 'low';
            source.warnings = ['We could not validate AI extraction for this source. Your previous product state is still active.'];
            source.warningText = 'We could not validate AI extraction for this source. Your previous product state is still active.';
          }
          draft.jobs[jobId] = {
            jobId,
            jobType: 'ingest',
            productId,
            status: 'failed',
            errorCode: errorCodes.INTERNAL_ERROR,
            message: error.message,
            retryable: true,
          };
          return syncSemanticState(draft);
        });
      }
    }, 700);

    return { jobId, sourceId, status: 'queued' };
  }

  async function queueArtifactJob(productId, file, body, options = {}) {
    const validated = validateArtifactUpload({
      body: {
        ...body,
        productId,
      },
      file,
      metadataFile: options.metadataFile || null,
      errorCodes,
    });

    const state = await readState();
    const effectiveFeatureFlags = resolveEffectiveFeatureFlags({
      runtimeConfig,
      persistedSemanticConfig: state.semanticConfig,
    });
    const queuedPublicationGuard = currentAggregateGuardForProduct(state, productId);
    const sourceFamilyClass = getSourceFamilyClass(validated.sourceType);
    const useSemanticServicePath = effectiveFeatureFlags.enableSemanticServicePath
      && ['retrieval_eligible', 'fixed_schema_structured'].includes(sourceFamilyClass);

    if (validated.sourceType === 'transcript' && !useSemanticServicePath) {
      return queueTranscriptJob(productId, file, {
        meetingTitle: validated.title,
        meetingDate: validated.sourceDate,
        attendees: validated.participants,
        notes: validated.notes,
      }, options);
    }

    const failureKey = `${productId}:${options.testCase || ''}`;
    if (options.testCase === 'artifactUploadFailure' && !artifactUploadFailureAttempts.has(failureKey)) {
      artifactUploadFailureAttempts.set(failureKey, 1);
      throw new HttpError(503, errorCodes.INTERNAL_ERROR, 'Something went wrong. Try again.', { retryable: true });
    }

    const fallbackSourceId = `src-${state.nextIds.source++}`;
    const sourceId = buildTestSourceId(file.originalname, fallbackSourceId);
    const jobId = `job-${state.nextIds.job++}`;
    const participants = parseAttendees(validated.participants);
    const title = validated.title;
    const sourceDate = validated.sourceDate;
    const sourceType = validated.sourceType;
    const rawArtifactKey = artifactKeyForSource(productId, sourceId, file.originalname);
    const normalizedArtifactKey = artifactKeyForSource(productId, sourceId, 'normalized.txt');
    const effectiveExecutionDecision = useSemanticServicePath
      ? resolveSemanticExecutionPolicy({
        productId,
        sourceType,
        runtimeConfig,
        stateSemanticConfig: state.semanticConfig,
      })
      : null;
    await artifactStore.writeBufferArtifact({
      bucketType: 'raw',
      key: rawArtifactKey,
      buffer: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
    });

    await updateState((draft) => {
      draft.nextIds.source = state.nextIds.source;
      draft.nextIds.job = state.nextIds.job;
      const jobCreatedAt = nowIso();
      draft.jobs[jobId] = {
        jobId,
        jobType: 'ingest',
        productId,
        status: 'queued',
        stage: 'queued',
        sourceType,
        sourceFamilyClass,
        executionMode: effectiveExecutionDecision?.executionMode || null,
        createdAt: jobCreatedAt,
        updatedAt: jobCreatedAt,
        result: {
          sourceId,
          title,
          updatedDomains: isStructuredImportType(sourceType) ? ['sources', 'ask', 'reports', 'data'] : ['sources', 'ask', 'reports'],
        },
      };
      const data = draft.productData[productId];
      const sourceSummary = buildSourceSummary({
        sourceType,
        sourceDate,
        title,
        author: validated.author || draft.session.user.displayName,
        participants,
        warningText: null,
        processingStatus: 'queued',
      });
      data.sources.unshift({
        id: sourceId,
        type: sourceType,
        sourceType,
        sourceFamilyClass,
        title,
        date: sourceDate,
        meta: sourceSummary.meta,
        previewText: 'Artifact queued for processing.',
        author: validated.author || draft.session.user.displayName,
        participants,
        contentType: file.mimetype || 'application/octet-stream',
        rawArtifactKey,
        normalizedArtifactKey,
        ingestStatus: 'queued',
        indexed: false,
        indexingStatus: sourceFamilyClass === 'retrieval_eligible'
          ? (effectiveFeatureFlags.enableDentalRetrievalIndexing ? 'queued' : 'disabled')
          : 'not_applicable',
        chunkCount: 0,
        embeddingDims: null,
        embeddingSource: 'none',
        chunkArtifacts: [],
        summary: 'Artifact queued for processing.',
        citations: [],
        confidence: 'low',
        validationStatus: 'pending',
        replayStatus: 'not_applicable',
        warnings: [],
        metadata: {
          ...validated.metadata,
          sourceFamily: getSourceTypeDefinition(sourceType)?.family || 'document',
        },
        warningText: null,
        openable: true,
      });
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId,
        action: 'artifact.upload_queued',
        targetType: 'source',
        targetId: sourceId,
        payload: { jobId, title, sourceType, sourceDate },
      });
      return draft;
    });

    setTimeout(async () => {
      try {
        await updateState((draft) => {
          draft.jobs[jobId] = {
            ...draft.jobs[jobId],
            status: 'running',
            stage: useSemanticServicePath ? 'normalizing' : 'extracting',
            updatedAt: nowIso(),
          };
          const source = draft.productData[productId].sources.find((item) => item.id === sourceId);
          if (source) {
            source.ingestStatus = 'running';
            source.meta = buildSourceSummary({
              sourceType,
              sourceDate,
              title,
              author: source.author,
              participants,
              warningText: null,
              processingStatus: 'running',
            }).meta;
          }
          return draft;
        });

        if (useSemanticServicePath) {
          const executionDecision = effectiveExecutionDecision || resolveSemanticExecutionPolicy({
            productId,
            sourceType,
            runtimeConfig,
            stateSemanticConfig: state.semanticConfig,
          });
          await updateState((draft) => {
            draft.jobs[jobId] = {
              ...draft.jobs[jobId],
              stage: executionDecision.executionMode === 'live' ? 'live_extraction' : 'replay_extraction',
              executionMode: executionDecision.executionMode,
              updatedAt: nowIso(),
            };
            return draft;
          });
          const {
            normalized,
            extraction,
            promptRun,
            sourceFamilyClass: semanticSourceFamilyClass,
            citationProjection,
            warningText,
            warnings,
            indexingResult,
            updatedDomains,
            latestAttemptAt,
          } = await runSemanticIngest({
            artifactStore,
            normalizedArtifactKey,
            file,
            sourceType,
            sourceId,
            productId,
            title,
            sourceDate,
            author: validated.author || state.session.user.displayName,
            participants,
            executionDecision,
            runtimeConfig,
            testCase: options.testCase || '',
            featureFlags: effectiveFeatureFlags,
          });

          // Phase 2: LLM-driven aggregate status synthesis. Best-effort; falls back to seed-derived status on any failure.
          let llmAggregateContent = null;
          if (options.testCase !== 'publicationFailure') {
            try {
              const preAggState = await readState();
              const productName = preAggState.products.find((p) => p.id === productId)?.name || productId;
              const existingExtractions = (preAggState.sourceExtractions || []).filter((e) => e.productId === productId);
              const newExtractionRecord = {
                sourceId,
                productId,
                sourceType,
                sourceFamily: executionDecision.sourceFamily,
                documentDate: sourceDate,
                title,
                payload: {
                  ...extraction,
                  decisions: citationProjection.decisions,
                  citations: citationProjection.citations,
                },
              };
              const aggregateCall = await extractAggregateWithNova({
                productId,
                productName,
                productMission: '',
                extractions: [newExtractionRecord, ...existingExtractions],
                executionDecision: { promptVersion: executionDecision.promptVersion, executionMode: 'live' },
                runtimeConfig,
              });
              llmAggregateContent = aggregateCall?.payload || null;
              console.log(`[phase2] aggregate synth ok for ${productId}/${sourceId}: status=${llmAggregateContent?.status} conf=${llmAggregateContent?.confidence} drivers=${llmAggregateContent?.drivers?.length||0} risks=${llmAggregateContent?.riskFactors?.length||0}`);
            } catch (error) {
              console.warn(`[phase2] aggregate synthesis failed for ${productId}/${sourceId}: ${error?.code || error?.message || 'unknown'} — falling back to seed-derived status`);
            }
          }

          if (options.testCase === 'publicationFailure') {
            await updateState((draft) => {
              ensureSemanticCollections(draft);
              const data = draft.productData[productId];
              const product = draft.products.find((item) => item.id === productId);
              const source = data.sources.find((item) => item.id === sourceId);
              const activeAggregate = currentPublishedAggregateForProduct(draft, productId)
                || draft.productAggregates.find((item) => item.productId === productId)
                || null;
              const activeAggregateId = activeAggregate?.aggregateId || product?.semanticState?.aggregateId || `agg-${productId}-${Number(product?.evidenceVersion || data?.evidenceVersion || 1)}`;
              const aggregateVersion = Number(product?.evidenceVersion || data?.evidenceVersion || 1);
              const aggregateAttemptId = `agg-${productId}-attempt-${Date.now()}`;
              const validatedAggregate = validateAggregatePayload({
                productId,
                aggregatePayload: {
                  aggregateId: aggregateAttemptId,
                  productId,
                  aggregateVersion,
                  evidenceVersion: aggregateVersion,
                  sourceSetHash: `${productId}:${sourceId}:publication-failed`,
                  payload: {
                    productId,
                    sourceId,
                    summary: extraction.summary,
                    status: product?.status || 'risk',
                  },
                },
              });
              const aggregateRun = createAggregatePublicationRun({
                aggregateId: aggregateAttemptId,
                productId,
                executionMode: executionDecision.executionMode,
                modelId: promptRun.modelId,
                promptVersion: executionDecision.promptVersion,
                parentRunIds: [promptRun.runId],
                guardSnapshot: queuedPublicationGuard,
                status: 'failed',
                createdAt: latestAttemptAt,
              });

              if (source) {
                const sourceSummary = buildSourceSummary({
                  sourceType,
                  sourceDate,
                  title,
                  author: source.author,
                  participants: normalized.participants.length ? normalized.participants : participants,
                  warningText,
                  processingStatus: 'completed',
                });
                source.meta = sourceSummary.meta;
                source.previewText = normalized.previewText;
                source.normalizedArtifactKey = normalizedArtifactKey;
                source.chunkArtifacts = indexingResult.chunks || [];
                source.metadata = {
                  ...(source.metadata || {}),
                  ...(validated.metadata || {}),
                  ...normalized.normalizationMeta,
                  sourceFamily: executionDecision.sourceFamily,
                  normalizationVersion: normalized.normalizationVersion,
                  lineCount: normalized.lineCount,
                  providerRequestId: promptRun.providerRequestId,
                };
                source.sourceFamilyClass = semanticSourceFamilyClass;
                source.indexed = indexingResult.indexingStatus === 'indexed';
                source.indexingStatus = indexingResult.indexingStatus;
                source.chunkCount = indexingResult.chunkCount;
                source.embeddingDims = indexingResult.embeddingDims;
                source.embeddingSource = indexingResult.embeddingSource;
                source.ingestStatus = 'completed';
                source.extractionStatus = 'completed';
                source.validationStatus = 'valid';
                source.replayStatus = executionDecision.executionMode === 'replay' ? 'hit' : 'not_applicable';
                source.warningText = warningText;
                source.summary = extraction.summary;
                source.citations = citationProjection.citations;
                source.citationMode = citationProjection.citationMode;
                source.executionMode = executionDecision.executionMode;
                source.confidence = extraction.confidence;
                source.warnings = warnings;
              }

              data.sourceContents[sourceId] = normalized.normalizedText;
              data.latestEvidenceUpdate = {
                sourceId,
                title,
                sourceType,
                message: 'This source was stored, but product understanding was not refreshed. Last known good state remains active.',
                updatedDomains,
                impactType: 'evidence_only',
              };
              upsertSourceExtraction(draft, {
                sourceId,
                productId,
                sourceType,
                sourceFamily: executionDecision.sourceFamily,
                sourceFamilyClass: semanticSourceFamilyClass,
                schemaVersion: '1.0',
                promptFamily: `source-${sourceType}`,
                promptVersion: executionDecision.promptVersion,
                modelId: promptRun.modelId,
                normalizedHash: promptRun.inputHash || `${sourceId}:${sourceDate}`,
                payload: {
                  ...extraction,
                  decisions: citationProjection.decisions,
                  citations: citationProjection.citations,
                },
                validationStatus: 'valid',
                confidence: extraction.confidence,
                executionModeEffective: executionDecision.executionMode,
                replayStatus: executionDecision.executionMode === 'replay' ? 'hit' : 'not_applicable',
                replayKey: promptRun.replayKey,
                citationMode: citationProjection.citationMode,
                citationPayloadJson: citationProjection.citations,
                providerRequestId: promptRun.providerRequestId,
                normalizationVersion: normalized.normalizationVersion,
                lineCount: normalized.lineCount,
                warningCodes: ['publication_failed', ...citationProjection.warningCodes],
                indexingStatus: indexingResult.indexingStatus,
                chunkCount: indexingResult.chunkCount,
                embeddingDims: indexingResult.embeddingDims,
                embeddingSource: indexingResult.embeddingSource,
                promptRunId: promptRun.runId,
                createdAt: latestAttemptAt,
              });
              upsertPromptRun(draft, {
                ...promptRun,
                targetId: sourceId,
                citationMode: citationProjection.citationMode,
              });
              upsertPromptRun(draft, aggregateRun);
              const semanticState = buildEmailSemanticState({
                draft,
                runtimeConfig,
                executionMode: executionDecision.executionMode,
                freshnessStatus: 'degraded',
                usesLastKnownGood: true,
                reasonCodes: ['publication_failed', 'using_last_known_good', ...citationProjection.warningCodes],
                aggregateId: activeAggregateId,
                aggregateVersion,
                latestAttemptAt,
                lastPublishedAt: activeAggregate?.publishedAt || product?.semanticState?.lastPublishedAt || product?.lastSync || latestAttemptAt,
              });
              product.semanticState = semanticState;
              data.semanticState = semanticState;
              appendProductAggregateAttempt(draft, {
                ...validatedAggregate,
                schemaVersion: '1.0',
                promptVersion: executionDecision.promptVersion,
                modelId: promptRun.modelId,
                aggregateInputHash: `${productId}:${aggregateVersion}:publication-failed`,
                published: false,
                publishedAt: null,
                supersededAt: null,
                supersededBy: null,
                lastKnownGoodAggregateId: activeAggregateId,
                freshnessStatus: 'degraded',
                freshnessReasonJson: semanticState.reasonCodes,
                derivedFromLiveSources: executionDecision.executionMode === 'live',
                latestSourceRunAt: latestAttemptAt,
                sourceRunIdsJson: [promptRun.runId],
                publishedFromRunId: aggregateRun.runId,
                validationStatus: 'valid',
                validationErrorsJson: [],
                publicationGuardJson: queuedPublicationGuard,
                createdAt: latestAttemptAt,
              });
              draft.jobs[jobId] = {
                ...draft.jobs[jobId],
                status: 'partial',
                stage: 'publication_failed',
                executionMode: executionDecision.executionMode,
                warnings: ['publication_failed', ...citationProjection.warningCodes],
                message: semanticState.message,
                updatedAt: latestAttemptAt,
                result: {
                  sourceId,
                  title,
                  updatedDomains,
                },
              };
              return draft;
            });
            return;
          }

          await updateState((draft) => {
            ensureSemanticCollections(draft);
            const data = draft.productData[productId];
            const product = draft.products.find((item) => item.id === productId);
            const source = data.sources.find((item) => item.id === sourceId);
            const nextEvidenceVersion = Number(product?.evidenceVersion || data?.evidenceVersion || 1) + 1;
            const aggregateId = `agg-${productId}-${nextEvidenceVersion}`;
            const lastPublishedAt = latestAttemptAt;

            // Phase 2: mirror LLM aggregate onto product.* fields so the UI badge reflects the synthesis.
            if (llmAggregateContent) {
              const priorStatus = product.status;
              product.status = llmAggregateContent.status;
              product.statusLabel = llmAggregateContent.statusLabel;
              product.narrativeText = llmAggregateContent.summary;
              if (Array.isArray(llmAggregateContent.riskFactors) && llmAggregateContent.riskFactors[0]?.title) {
                product.biggestGap = llmAggregateContent.riskFactors[0].title;
              }
              console.log(`[phase2] product ${productId} status ${priorStatus} -> ${product.status} (${product.statusLabel})`);
            }

            const aggregatePayloadContent = llmAggregateContent
              ? {
                productId,
                status: llmAggregateContent.status,
                statusLabel: llmAggregateContent.statusLabel,
                summary: llmAggregateContent.summary,
                confidence: llmAggregateContent.confidence,
                drivers: llmAggregateContent.drivers,
                riskFactors: llmAggregateContent.riskFactors,
                health: product.health,
                narrative: {
                  summary: llmAggregateContent.summary,
                  evidenceGaps: (llmAggregateContent.riskFactors || []).slice(0, 2).map((r) => r.title),
                },
                recentSignals: product.recentSignals || [],
                data: data.data || {},
                reports: {
                  executiveSummaryInput: llmAggregateContent.summary,
                },
                synthesisSource: 'nova-pro-live',
              }
              : {
                productId,
                status: product.status,
                summary: product.narrativeText || extraction.summary,
                statusLabel: product.statusLabel,
                health: product.health,
                narrative: {
                  summary: product.narrativeText || '',
                  evidenceGaps: product.biggestGap ? [product.biggestGap] : [],
                },
                recentSignals: product.recentSignals || [],
                data: data.data || {},
                reports: {
                  executiveSummaryInput: product.narrativeText || '',
                },
                synthesisSource: 'seed-fallback',
              };

            const validatedAggregate = validateAggregatePayload({
              productId,
              aggregatePayload: {
                aggregateId,
                productId,
                aggregateVersion: nextEvidenceVersion,
                evidenceVersion: nextEvidenceVersion,
                sourceSetHash: `${productId}:${sourceId}:${nextEvidenceVersion}`,
                payload: aggregatePayloadContent,
              },
            });
            const aggregateRun = createAggregatePublicationRun({
              aggregateId,
              productId,
              executionMode: executionDecision.executionMode,
              modelId: promptRun.modelId,
              promptVersion: executionDecision.promptVersion,
              parentRunIds: [promptRun.runId],
              guardSnapshot: queuedPublicationGuard,
              createdAt: latestAttemptAt,
            });

            if (source) {
              const sourceSummary = buildSourceSummary({
                sourceType,
                sourceDate,
                title,
                author: source.author,
                participants: normalized.participants.length ? normalized.participants : participants,
                warningText,
                processingStatus: 'completed',
                });
              source.meta = sourceSummary.meta;
              source.previewText = normalized.previewText;
              source.normalizedArtifactKey = normalizedArtifactKey;
              source.chunkArtifacts = indexingResult.chunks || [];
              source.metadata = {
                ...(source.metadata || {}),
                ...(validated.metadata || {}),
                ...normalized.normalizationMeta,
                sourceFamily: executionDecision.sourceFamily,
                normalizationVersion: normalized.normalizationVersion,
                lineCount: normalized.lineCount,
                providerRequestId: promptRun.providerRequestId,
              };
              source.sourceFamilyClass = semanticSourceFamilyClass;
              source.indexed = indexingResult.indexingStatus === 'indexed';
              source.indexingStatus = indexingResult.indexingStatus;
              source.chunkCount = indexingResult.chunkCount;
              source.embeddingDims = indexingResult.embeddingDims;
              source.embeddingSource = indexingResult.embeddingSource;
              source.ingestStatus = 'completed';
              source.extractionStatus = 'completed';
              source.validationStatus = 'valid';
              source.replayStatus = executionDecision.executionMode === 'replay' ? 'hit' : 'not_applicable';
              source.warningText = warningText;
              source.summary = extraction.summary;
              source.citations = citationProjection.citations;
              source.citationMode = citationProjection.citationMode;
              source.executionMode = executionDecision.executionMode;
              source.confidence = extraction.confidence;
              source.warnings = warnings;
            }

            data.sourceContents[sourceId] = normalized.normalizedText;
            product.evidenceVersion = nextEvidenceVersion;
            data.evidenceVersion = nextEvidenceVersion;

            // Phase 3: for structured imports, preserve the legacy-path side-effect
            // that populates data.data[dataset] rows from the CSV content. Use the
            // shared buildStructuredRows mapper so column names (e.g. blocker_id → id)
            // match what the UI and Data-tab tests expect.
            const structuredDefinition = getSourceTypeDefinition(sourceType);
            if (isStructuredImportType(sourceType) && structuredDefinition?.dataset) {
              const structuredRows = buildStructuredRows({
                sourceType,
                rawText: normalized.normalizedText,
                documentDate: sourceDate,
              });
              if (structuredRows && structuredRows.length) {
                data.data = { ...(data.data || {}), [structuredDefinition.dataset]: structuredRows };
                data.lastStructuredImport = {
                  sourceId,
                  title,
                  dataset: structuredDefinition.dataset,
                  sourceType,
                  updatedAt: new Date().toISOString(),
                };
              }
            }

            const isStructured = isStructuredImportType(sourceType);
            data.latestEvidenceUpdate = {
              sourceId,
              title,
              sourceType,
              message: executionDecision.executionMode === 'live'
                ? 'Live AI extraction completed. New evidence is now available across Sources, Ask, and reports.'
                : 'AI extraction completed in replay mode. New evidence is now available across Sources, Ask, and reports.',
              updatedDomains: isStructured ? [...new Set([...(updatedDomains || []), 'data'])] : updatedDomains,
              impactType: isStructured ? 'structured' : 'evidence_only',
            };
            product.recentSignals.unshift({
              id: `sig-${Date.now()}`,
              dateLabel: nowDateLabel(),
              type: sourceType,
              title: `${title} processed`,
            });
            upsertSourceExtraction(draft, {
              sourceId,
              productId,
              sourceType,
              sourceFamily: executionDecision.sourceFamily,
              sourceFamilyClass: semanticSourceFamilyClass,
              schemaVersion: '1.0',
              promptFamily: `source-${sourceType}`,
              promptVersion: executionDecision.promptVersion,
              modelId: promptRun.modelId,
              normalizedHash: promptRun.inputHash,
              payload: {
                ...extraction,
                decisions: citationProjection.decisions,
                citations: citationProjection.citations,
              },
              validationStatus: 'valid',
              confidence: extraction.confidence,
              executionModeEffective: executionDecision.executionMode,
              replayStatus: executionDecision.executionMode === 'replay' ? 'hit' : 'not_applicable',
              replayKey: promptRun.replayKey,
              citationMode: citationProjection.citationMode,
              citationPayloadJson: citationProjection.citations,
              providerRequestId: promptRun.providerRequestId,
              normalizationVersion: normalized.normalizationVersion,
              lineCount: normalized.lineCount,
              warningCodes: citationProjection.warningCodes,
              indexingStatus: indexingResult.indexingStatus,
              chunkCount: indexingResult.chunkCount,
              embeddingDims: indexingResult.embeddingDims,
              embeddingSource: indexingResult.embeddingSource,
              promptRunId: promptRun.runId,
              createdAt: latestAttemptAt,
            });
            upsertPromptRun(draft, {
              ...promptRun,
              targetId: sourceId,
              citationMode: citationProjection.citationMode,
            });
            upsertPromptRun(draft, aggregateRun);
            const semanticState = buildEmailSemanticState({
              draft,
              runtimeConfig,
              executionMode: executionDecision.executionMode,
              freshnessStatus: 'fresh',
              usesLastKnownGood: false,
              reasonCodes: citationProjection.warningCodes,
              aggregateId,
              aggregateVersion: nextEvidenceVersion,
              latestAttemptAt,
              lastPublishedAt,
            });
            product.semanticState = semanticState;
            data.semanticState = semanticState;
            const publicationResult = replaceProductAggregateWithGuard(draft, {
              ...validatedAggregate,
              schemaVersion: '1.0',
              promptVersion: executionDecision.promptVersion,
              modelId: promptRun.modelId,
              aggregateInputHash: `${productId}:${nextEvidenceVersion}`,
              published: true,
              publishedAt: lastPublishedAt,
              supersededAt: null,
              supersededBy: null,
              lastKnownGoodAggregateId: aggregateId,
              freshnessStatus: semanticState.freshnessStatus,
              freshnessReasonJson: semanticState.reasonCodes,
              derivedFromLiveSources: executionDecision.executionMode === 'live',
              latestSourceRunAt: latestAttemptAt,
              sourceRunIdsJson: [promptRun.runId],
              publishedFromRunId: aggregateRun.runId,
              validationStatus: 'valid',
              validationErrorsJson: [],
              publicationGuardJson: queuedPublicationGuard,
              createdAt: latestAttemptAt,
            }, queuedPublicationGuard);

            if (!publicationResult.published) {
              const staleSemanticState = buildEmailSemanticState({
                draft,
                runtimeConfig,
                executionMode: executionDecision.executionMode,
                freshnessStatus: 'degraded',
                usesLastKnownGood: true,
                reasonCodes: ['stale_publication_rejected', 'using_last_known_good', ...citationProjection.warningCodes],
                aggregateId: publicationResult.currentPublished?.aggregateId || product?.semanticState?.aggregateId || null,
                aggregateVersion: Number(publicationResult.currentPublished?.aggregateVersion || product?.semanticState?.aggregateVersion || nextEvidenceVersion),
                latestAttemptAt,
                lastPublishedAt: publicationResult.currentPublished?.publishedAt || product?.semanticState?.lastPublishedAt || latestAttemptAt,
              });
              product.semanticState = staleSemanticState;
              data.semanticState = staleSemanticState;
              draft.jobs[jobId] = {
                ...draft.jobs[jobId],
                status: 'partial',
                stage: 'stale_publication_rejected',
                executionMode: executionDecision.executionMode,
                warnings: ['stale_publication_rejected', ...citationProjection.warningCodes],
                errorCode: 'STALE_PUBLICATION_REJECTED',
                message: staleSemanticState.message,
                updatedAt: latestAttemptAt,
                result: {
                  sourceId,
                  title,
                  updatedDomains,
                },
              };
              return draft;
            }
            draft.jobs[jobId] = {
              ...draft.jobs[jobId],
              status: 'completed',
              stage: 'completed',
              executionMode: executionDecision.executionMode,
              warnings: citationProjection.warningCodes,
              updatedAt: latestAttemptAt,
              result: {
                sourceId,
                title,
                updatedDomains,
              },
            };
            return draft;
          });
          return;
        }

        const extracted = extractArtifactContent({ file, sourceType, testCase: options.testCase || '' });
        await artifactStore.writeTextArtifact({
          bucketType: 'normalized',
          key: normalizedArtifactKey,
          content: extracted.normalizedText,
          contentType: 'text/plain; charset=utf-8',
        });

        if (options.testCase === 'forcedInvalidExtraction') {
          const injected = new Error('Injected extraction schema failure.');
          injected.code = 'EXTRACTION_INVALID';
          throw injected;
        }

        const shouldIndexLegacyArtifact = sourceFamilyClass === 'retrieval_eligible'
          && !(productId === 'dental' && !effectiveFeatureFlags.enableDentalRetrievalIndexing);
        const chunkArtifacts = shouldIndexLegacyArtifact
          ? buildChunkArtifacts({
            productId,
            sourceId,
            sourceType,
            sourceDate,
            title,
            author: validated.author || state.session.user.displayName,
            participants,
            text: extracted.normalizedText,
          })
          : [];

        for (const chunk of chunkArtifacts) {
          await artifactStore.writeTextArtifact({
            bucketType: 'normalized',
            key: chunk.chunkKey,
            content: chunk.chunkText,
            contentType: 'text/markdown; charset=utf-8',
          });
          await artifactStore.writeTextArtifact({
            bucketType: 'normalized',
            key: chunk.metadataKey,
            content: JSON.stringify(chunk.metadata, null, 2),
            contentType: 'application/json; charset=utf-8',
          });
        }

        const legacyIndexingResult = await indexTranscriptEvidence({
          runtimeConfig,
          productId,
          sourceId,
          sourceType,
          sourceFamilyClass,
          sourceDate,
          title,
          author: validated.author || state.session.user.displayName,
          participants,
          normalizedText: extracted.normalizedText,
          featureFlags: effectiveFeatureFlags,
          testCase: options.testCase || '',
        });
        const completedIndexingStatus = legacyIndexingResult.indexingStatus;

        const structuredRows = isStructuredImportType(sourceType)
          ? parseStructuredImportRows({ sourceType, text: extracted.normalizedText })
          : null;
        const sourceDefinition = getSourceTypeDefinition(sourceType);
        const terminalStatus = extracted.warningText ? 'partial' : 'completed';
        const updatedDomains = isStructuredImportType(sourceType) ? ['sources', 'ask', 'reports', 'data'] : ['sources', 'ask', 'reports'];
        const corpusAttributes = getCorpusMetadataAttributes(validated.metadata);

        await updateState((draft) => {
          const data = draft.productData[productId];
          const product = draft.products.find((item) => item.id === productId);
          const nextEvidenceVersion = Number(product?.evidenceVersion || data?.evidenceVersion || 1) + 1;
          const latestEvidenceUpdate = {
            sourceId,
            title,
            sourceType,
            message: 'New evidence is now available across Sources, Ask, and reports.',
            updatedDomains,
            impactType: isStructuredImportType(sourceType) ? 'structured' : 'evidence_only',
          };

          if (corpusAttributes) {
            const uploadedEntry = buildUploadedCorpusEntry({
              sourceId,
              productId,
              productName: corpusAttributes.product_name || product?.name || data?.productName || productId,
              relativePath: validated.metadata?.corpusRelativePath || '',
              format: file.originalname.split('.').pop()?.toLowerCase() || 'txt',
              sourceType,
              documentDate: sourceDate,
              author: validated.author || corpusAttributes.author || draft.session.user.displayName,
              title,
              wave: corpusAttributes.wave || 'uploaded',
              waveLabel: corpusAttributes.wave_label || 'Uploaded',
              demoEffect: corpusAttributes.demo_effect || '',
              containsDecisions: String(corpusAttributes.contains_decisions).toLowerCase() === 'true',
              containsActionItems: String(corpusAttributes.contains_action_items).toLowerCase() === 'true',
              statusSignal: corpusAttributes.status_signal || 'baseline',
              metadata: {
                ...(validated.metadata || {}),
                ...(extracted.metadata || {}),
                sourceFamily: getSourceTypeDefinition(sourceType)?.family || 'document',
              },
              rawText: extracted.normalizedText,
            });
            const existingEntries = Array.isArray(data.entries) ? data.entries : [];
            const nextEntries = [
              uploadedEntry,
              ...existingEntries.filter((entry) => !sameCorpusEntry(entry, uploadedEntry)),
            ];
            const nextLatestCorpusDate = [draft.importedCorpus?.latestCorpusDate, uploadedEntry.isoDate]
              .filter(Boolean)
              .sort((left, right) => new Date(right) - new Date(left))[0];
            const derived = deriveCorpusProductState({
              productId,
              productEntries: nextEntries,
              latestCorpusDate: nextLatestCorpusDate,
            });

            if (!derived) {
              throw new Error(`Unable to derive corpus state for ${productId}.`);
            }

            derived.product.evidenceVersion = nextEvidenceVersion;
            derived.productData.evidenceVersion = nextEvidenceVersion;
            derived.productData.latestEvidenceUpdate = latestEvidenceUpdate;
            derived.productData.sourceContents[sourceId] = extracted.normalizedText;

            if (structuredRows && sourceDefinition?.dataset) {
              derived.productData.lastStructuredImport = {
                sourceId,
                title,
                dataset: sourceDefinition.dataset,
                sourceType,
                updatedAt: nowIso(),
              };
            }

            const derivedSource = derived.productData.sources.find((item) => item.id === sourceId);
            if (derivedSource) {
              const sourceSummary = buildSourceSummary({
                sourceType,
                sourceDate,
                title,
                author: derivedSource.author,
                participants,
                warningText: extracted.warningText,
                processingStatus: terminalStatus,
              });
              derivedSource.meta = sourceSummary.meta;
              derivedSource.previewText = extracted.previewText;
              derivedSource.normalizedArtifactKey = normalizedArtifactKey;
              derivedSource.chunkArtifacts = chunkArtifacts.map((chunk) => ({
                chunkIndex: chunk.chunkIndex,
                chunkKey: chunk.chunkKey,
                metadataKey: chunk.metadataKey,
                tokenCount: chunk.tokenCount,
              }));
              derivedSource.metadata = {
                ...(derivedSource.metadata || {}),
                ...(validated.metadata || {}),
                ...(extracted.metadata || {}),
              };
              derivedSource.indexed = completedIndexingStatus === 'indexed';
              derivedSource.indexingStatus = completedIndexingStatus;
              derivedSource.chunkCount = legacyIndexingResult.chunkCount || 0;
              derivedSource.embeddingDims = legacyIndexingResult.embeddingDims ?? null;
              derivedSource.embeddingSource = legacyIndexingResult.embeddingSource || 'none';
              derivedSource.ingestStatus = terminalStatus;
              derivedSource.warningText = extracted.warningText;
              derivedSource.contentType = file.mimetype || derivedSource.contentType || 'application/octet-stream';
              derivedSource.summary = extracted.previewText;
              derivedSource.citations = [{
                kind: sourceType === 'slide_deck'
                  ? 'slide'
                  : getSourceTypeDefinition(sourceType)?.structured
                    ? 'row_range'
                    : sourceType === 'email' || sourceType === 'transcript'
                      ? 'line_range'
                      : 'page_section',
                ...(sourceType === 'slide_deck'
                  ? { slideNumber: 1, label: 'Slide 1' }
                  : getSourceTypeDefinition(sourceType)?.structured
                    ? { sheetName: 'Sheet1', startRow: 1, endRow: Math.max(1, Math.min(structuredRows?.length || 1, 3)), label: `Rows 1-${Math.max(1, Math.min(structuredRows?.length || 1, 3))}` }
                    : sourceType === 'email' || sourceType === 'transcript'
                      ? { start: 1, end: Math.max(1, Math.min(extracted.normalizedText.split(/\r?\n/).filter(Boolean).length, 4)), label: `Lines 1-${Math.max(1, Math.min(extracted.normalizedText.split(/\r?\n/).filter(Boolean).length, 4))}` }
                      : { page: 1, section: 'Preview', label: 'Page 1' }),
              }];
              derivedSource.confidence = terminalStatus === 'partial' ? 'medium' : 'high';
              derivedSource.warnings = extracted.warningText ? [extracted.warningText] : [];
            }

            draft.productData[productId] = derived.productData;
            draft.products = sortProductsByStatusAndHealth(
              draft.products.map((item) => (item.id === productId ? derived.product : item))
            );
            draft.importedCorpus = {
              ...(draft.importedCorpus || {}),
              latestCorpusDate: nextLatestCorpusDate,
              artifactCount: Number(draft.importedCorpus?.artifactCount || 0) + 1,
            };
          } else {
            const source = data.sources.find((item) => item.id === sourceId);
            if (source) {
              const sourceSummary = buildSourceSummary({
                sourceType,
                sourceDate,
                title,
                author: source.author,
                participants,
                warningText: extracted.warningText,
                processingStatus: terminalStatus,
              });
              source.meta = sourceSummary.meta;
              source.previewText = extracted.previewText;
              source.normalizedArtifactKey = normalizedArtifactKey;
              source.chunkArtifacts = chunkArtifacts.map((chunk) => ({
                chunkIndex: chunk.chunkIndex,
                chunkKey: chunk.chunkKey,
                metadataKey: chunk.metadataKey,
                tokenCount: chunk.tokenCount,
              }));
              source.metadata = {
                ...(source.metadata || {}),
                ...(validated.metadata || {}),
                ...(extracted.metadata || {}),
              };
              source.indexed = completedIndexingStatus === 'indexed';
              source.indexingStatus = completedIndexingStatus;
              source.chunkCount = legacyIndexingResult.chunkCount || 0;
              source.embeddingDims = legacyIndexingResult.embeddingDims ?? null;
              source.embeddingSource = legacyIndexingResult.embeddingSource || 'none';
              source.ingestStatus = terminalStatus;
              source.warningText = extracted.warningText;
              source.summary = extracted.previewText;
              source.citations = [{
                kind: sourceType === 'slide_deck'
                  ? 'slide'
                  : getSourceTypeDefinition(sourceType)?.structured
                    ? 'row_range'
                    : sourceType === 'email' || sourceType === 'transcript'
                      ? 'line_range'
                      : 'page_section',
                ...(sourceType === 'slide_deck'
                  ? { slideNumber: 1, label: 'Slide 1' }
                  : getSourceTypeDefinition(sourceType)?.structured
                    ? { sheetName: 'Sheet1', startRow: 1, endRow: Math.max(1, Math.min(structuredRows?.length || 1, 3)), label: `Rows 1-${Math.max(1, Math.min(structuredRows?.length || 1, 3))}` }
                    : sourceType === 'email' || sourceType === 'transcript'
                      ? { start: 1, end: Math.max(1, Math.min(extracted.normalizedText.split(/\r?\n/).filter(Boolean).length, 4)), label: `Lines 1-${Math.max(1, Math.min(extracted.normalizedText.split(/\r?\n/).filter(Boolean).length, 4))}` }
                      : { page: 1, section: 'Preview', label: 'Page 1' }),
              }];
              source.confidence = terminalStatus === 'partial' ? 'medium' : 'high';
              source.warnings = extracted.warningText ? [extracted.warningText] : [];
            }
            data.sourceContents[sourceId] = extracted.normalizedText;
            if (structuredRows && sourceDefinition?.dataset) {
              data.data[sourceDefinition.dataset] = structuredRows;
              data.lastStructuredImport = {
                sourceId,
                title,
                dataset: sourceDefinition.dataset,
                sourceType,
                updatedAt: nowIso(),
              };
            }
            product.evidenceVersion = nextEvidenceVersion;
            data.evidenceVersion = product.evidenceVersion;
            data.latestEvidenceUpdate = latestEvidenceUpdate;
            product.recentSignals.unshift({
              id: `sig-${Date.now()}`,
              dateLabel: nowDateLabel(),
              type: sourceType,
              title: `${title} processed`,
            });
          }

          draft.jobs[jobId] = {
            ...draft.jobs[jobId],
            status: terminalStatus,
            stage: terminalStatus,
            updatedAt: nowIso(),
            result: {
              sourceId,
              title,
              updatedDomains,
            },
          };
          return syncSemanticState(draft);
        });
      } catch (error) {
        await updateState((draft) => {
          const source = draft.productData[productId].sources.find((item) => item.id === sourceId);
          if (source) {
            source.ingestStatus = 'failed';
            source.indexed = false;
            source.warningText = 'We could not validate AI extraction for this source. Your previous product state is still active.';
            source.meta = buildSourceSummary({
              sourceType,
              sourceDate,
              title,
              author: source.author,
              participants,
              warningText: source.warningText,
              processingStatus: 'failed',
            }).meta;
            source.confidence = 'low';
            source.warnings = [source.warningText];
          }
          draft.jobs[jobId] = {
            ...draft.jobs[jobId],
            status: 'failed',
            stage: 'failed',
            errorCode: errorCodes.INTERNAL_ERROR,
            message: error.message,
            retryable: true,
            updatedAt: nowIso(),
          };
          return syncSemanticState(draft);
        });
      }
    }, 400);

    return {
      jobId,
      sourceId,
      status: 'queued',
      title,
      effectiveExecutionMode: effectiveExecutionDecision?.executionMode || null,
      updatedDomains: isStructuredImportType(sourceType) ? ['sources', 'ask', 'reports', 'data'] : ['sources', 'ask', 'reports'],
    };
  }

  async function publishWeeklyUpdate(productId, payload, actorSub) {
    const state = await readState();
    const weeklyUpdateId = `wu-${state.nextIds.weekly++}`;
    const sourceId = `src-${Date.now()}`;
    const weeklyContent = [
      `Week Ending: ${payload.weekEnding}`,
      '',
      `Summary: ${payload.summary}`,
      '',
      `Accomplishments: ${payload.accomplishments}`,
      '',
      `Risks: ${payload.risks || 'None provided.'}`,
      '',
      `Next Steps: ${payload.nextSteps}`,
    ].join('\n');
    const normalizedArtifactKey = artifactKeyForSource(productId, sourceId, 'weekly-update.md');
    await artifactStore.writeTextArtifact({ bucketType: 'normalized', key: normalizedArtifactKey, content: weeklyContent, contentType: 'text/markdown; charset=utf-8' });
    await updateState((draft) => {
      draft.nextIds.weekly = state.nextIds.weekly;
      const product = draft.products.find((item) => item.id === productId);
      const data = draft.productData[productId];
      data.weeklyUpdates.unshift({ id: weeklyUpdateId, ...payload, authorSub: actorSub });
      data.sources.unshift({
        id: sourceId,
        type: 'weekly',
        title: `Weekly Update - ${payload.weekEnding}`,
        date: payload.weekEnding,
        meta: 'PM Hub · Published in app',
        previewText: payload.summary,
        author: draft.session.user.displayName,
        participants: [],
        contentType: 'text/markdown',
        normalizedArtifactKey,
        openable: true,
      });
      data.sourceContents[sourceId] = weeklyContent;
      product.health.freshness = Math.min(100, product.health.freshness + 3);
      product.recentSignals.unshift({ id: `sig-${Date.now()}`, dateLabel: 'today', type: 'weekly', title: 'Weekly update published' });
      appendAuditEvent(draft, {
        actorSub,
        productId,
        action: 'weekly.published',
        targetType: 'weekly-update',
        targetId: weeklyUpdateId,
        payload: { weekEnding: payload.weekEnding, sourceId },
      });
      return syncSemanticState(draft);
    });
    return { weeklyUpdateId, status: 'published' };
  }

  async function queueReportJob(productId) {
    const state = await readState();
    const reportId = `rep-${state.nextIds.report++}`;
    const jobId = `job-${state.nextIds.job++}`;
    readModel.getProductOrThrow(state, productId);

    await updateState((draft) => {
      draft.nextIds.report = state.nextIds.report;
      draft.nextIds.job = state.nextIds.job;
      draft.jobs[jobId] = {
        jobId,
        jobType: 'report',
        status: 'pending',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        attempts: 0,
        payload: {
          productId,
          reportId,
          reportType: 'weekly',
          period: { preset: 'current' },
        },
        result: null,
      };
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId,
        action: 'report.generation_started',
        targetType: 'report',
        targetId: reportId,
        payload: { jobId, reportType: 'weekly' },
      });
      return draft;
    });

    return { reportId, jobId, status: 'pending', pollUrl: `/api/v1/jobs/${jobId}` };
  }

  async function updateReportSection(reportId, sectionId, body, canEdit, expectedRevision = null) {
    if (!canEdit) {
      throw new HttpError(403, errorCodes.FORBIDDEN, 'You do not have access to this product.');
    }
    let currentRevision = 1;
    let nextRevision = 1;
    await updateState((draft) => {
      const report = draft.reports[reportId];
      if (!report) {
        throw readModel.notFound('Report not found.');
      }
      const section = report.sections.find((item) => item.sectionId === sectionId);
      if (!section) {
        throw readModel.notFound('Report section not found.');
      }
      if (!Object.hasOwn(section, 'bodyGenerated')) {
        section.bodyGenerated = section.body;
      }
      if (!Object.hasOwn(section, 'revision') || !Number.isFinite(section.revision)) {
        section.revision = 1;
      }
      currentRevision = section.revision;
      const hasExpectedRevision = expectedRevision !== null
        && expectedRevision !== undefined
        && Number.isFinite(Number(expectedRevision));
      if (hasExpectedRevision && Number(expectedRevision) !== currentRevision) {
        throw new HttpError(409, errorCodes.CONFLICT, 'This section was updated elsewhere. Refresh and try again.');
      }
      section.bodyCurrent = body;
      section.body = body;
      section.editedAt = nowIso();
      section.revision = currentRevision + 1;
      nextRevision = section.revision;
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: report.productId,
        action: 'report.section_saved',
        targetType: 'report-section',
        targetId: sectionId,
        payload: { reportId, sectionId },
      });
      return draft;
    });
    return { sectionId, status: 'saved', body, revision: nextRevision, previousRevision: currentRevision };
  }

  async function queueExportJob(productId, reportId, format, options = {}) {
    const state = await readState();
    const jobId = `job-${state.nextIds.job++}`;
    await updateState((draft) => {
      draft.nextIds.job = state.nextIds.job;
      draft.jobs[jobId] = {
        jobId,
        jobType: 'export',
        status: 'pending',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        attempts: 0,
        payload: {
          productId,
          reportId,
          format,
          testCase: options.testCase || null,
        },
        result: null,
      };
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId,
        action: 'export.started',
        targetType: 'report',
        targetId: reportId,
        payload: { format, jobId },
      });
      return draft;
    });

    return { jobId, status: 'pending', pollUrl: `/api/v1/jobs/${jobId}` };
  }

  async function queueConnectorSync(connectorType, options = {}) {
    assertConnectorTypeOrThrow(connectorType);
    const state = await readState();
    const jobId = `job-${state.nextIds.job++}`;
    const createdAt = nowIso();
    await updateState((draft) => {
      draft.nextIds.job = state.nextIds.job;
      draft.jobs[jobId] = {
        jobId,
        jobType: 'connector-sync',
        status: 'pending',
        createdAt,
        updatedAt: createdAt,
        attempts: 0,
        payload: {
          connectorType,
          testCase: options.testCase || null,
        },
        result: null,
      };
      appendAuditEvent(draft, {
        actorSub: draft.session?.user?.sub || 'user-123',
        productId: null,
        action: 'connector.sync_queued',
        targetType: 'connector',
        targetId: connectorType,
        payload: {
          jobId,
          connectorType,
        },
      });
      return draft;
    });
    return {
      jobId,
      status: 'pending',
      pollUrl: `/api/v1/jobs/${jobId}`,
    };
  }

  async function getConnectorStatus(options = {}) {
    const state = await readState();
    const now = options.now ? new Date(options.now) : new Date();
    const lagAlertMinutes = Number(runtimeConfig?.connectors?.lagAlertMinutes || 120);
    const failureStreakAlertThreshold = Number(runtimeConfig?.connectors?.failureStreakAlertThreshold || 3);
    const connectorProfiles = Object.values(state.connectorProfiles || {});
    const alerts = [];
    for (const profile of connectorProfiles) {
      const failureStreak = Number(profile.consecutiveFailures || 0);
      if (failureStreak >= failureStreakAlertThreshold) {
        alerts.push({
          code: 'connector.failure_streak',
          level: 'error',
          connectorProfileId: profile.connectorProfileId,
          connectorType: profile.connectorType,
          productId: profile.productId || null,
          message: `${profile.connectorType} failure streak is ${failureStreak}.`,
        });
      }
      if (profile.lastRunAt) {
        const lagMinutes = Math.max(0, Math.floor((now.getTime() - new Date(profile.lastRunAt).getTime()) / 60000));
        if (lagMinutes >= lagAlertMinutes) {
          alerts.push({
            code: 'connector.lag',
            level: 'warn',
            connectorProfileId: profile.connectorProfileId,
            connectorType: profile.connectorType,
            productId: profile.productId || null,
            lagMinutes,
            message: `${profile.connectorType} has not run for ${lagMinutes} minutes.`,
          });
        }
      }
    }

    return {
      generatedAt: now.toISOString(),
      alerts,
      profiles: connectorProfiles.map((profile) => ({
        connectorProfileId: profile.connectorProfileId,
        connectorType: profile.connectorType,
        productId: profile.productId || null,
        enabled: profile.enabled !== false,
        lastRunAt: profile.lastRunAt || null,
        lastCursor: profile.lastCursor ?? null,
        watermark: profile.watermark ?? null,
        consecutiveFailures: Number(profile.consecutiveFailures || 0),
      })),
      recentRuns: (state.syncRuns || [])
        .slice(0, 25)
        .map((run) => ({
          syncRunId: run.syncRunId,
          connectorProfileId: run.connectorProfileId,
          connectorType: run.connectorType || syncRunConnectorType(run.connectorType),
          status: run.status,
          startedAt: run.startedAt || null,
          endedAt: run.endedAt || null,
          errorCode: run.errorCode || null,
          errorMessage: run.errorMessage || null,
          metrics: run.metrics || {},
        })),
    };
  }

  function getExportArtifactKey(productId, reportId, fileName) {
    return artifactKeyForExport(productId, reportId, fileName);
  }

  return {
    queueArtifactJob,
    queueTranscriptJob,
    publishWeeklyUpdate,
    queueReportJob,
    updateReportSection,
    queueExportJob,
    queueConnectorSync,
    getConnectorStatus,
    processPendingJobs,
    getExportArtifactKey,
  };
}
