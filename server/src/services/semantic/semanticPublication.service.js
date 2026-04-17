import { computeSemanticTrustState } from './semanticFreshness.service.js';

export function ensureSemanticCollections(draft) {
  draft.sourceExtractions = Array.isArray(draft.sourceExtractions) ? draft.sourceExtractions : [];
  draft.productAggregates = Array.isArray(draft.productAggregates) ? draft.productAggregates : [];
  draft.promptRuns = Array.isArray(draft.promptRuns) ? draft.promptRuns : [];
  draft.semanticConfig = draft.semanticConfig && typeof draft.semanticConfig === 'object'
    ? draft.semanticConfig
    : {};
}

export function upsertSourceExtraction(draft, record) {
  ensureSemanticCollections(draft);
  draft.sourceExtractions = [
    record,
    ...draft.sourceExtractions.filter((item) => item.sourceId !== record.sourceId),
  ];
}

export function upsertPromptRun(draft, run) {
  ensureSemanticCollections(draft);
  draft.promptRuns = [
    run,
    ...draft.promptRuns.filter((item) => item.runId !== run.runId),
  ];
}

export function replaceProductAggregate(draft, aggregate) {
  ensureSemanticCollections(draft);
  draft.productAggregates = draft.productAggregates.map((item) => (
    item.productId === aggregate.productId && item.published
      ? { ...item, published: false, supersededAt: aggregate.createdAt, supersededBy: aggregate.aggregateId }
      : item
  ));
  draft.productAggregates.unshift(aggregate);
}

export function appendProductAggregateAttempt(draft, aggregate) {
  ensureSemanticCollections(draft);
  draft.productAggregates.unshift(aggregate);
}

export function buildPublicationGuard(aggregate = {}) {
  return {
    aggregateId: aggregate.aggregateId || null,
    aggregateVersion: Number(aggregate.aggregateVersion || 0),
    evidenceVersion: Number(aggregate.evidenceVersion || aggregate.aggregateVersion || 0),
    sourceSetHash: aggregate.sourceSetHash || null,
  };
}

export function createAggregatePublicationRun({
  aggregateId,
  productId,
  executionMode,
  modelId,
  promptVersion,
  parentRunIds = [],
  guardSnapshot = null,
  status = 'succeeded',
  createdAt = new Date().toISOString(),
} = {}) {
  return {
    runId: `aggregate-publication-${aggregateId}-${Date.now()}`,
    runRole: 'aggregate_publication',
    scope: 'aggregate_publication',
    targetId: aggregateId,
    productId,
    mode: executionMode,
    modelId,
    promptVersion,
    latencyMs: 0,
    status,
    errorJson: null,
    rawPayloadRef: null,
    provider: 'local-publication',
    providerRequestId: null,
    sourceFamily: 'aggregate',
    replayKey: null,
    cacheHit: false,
    citationMode: null,
    parentRunIdsJson: parentRunIds,
    guardSnapshotJson: guardSnapshot,
    createdAt,
  };
}

export function replaceProductAggregateWithGuard(draft, aggregate, expectedGuard = null) {
  ensureSemanticCollections(draft);
  const currentPublished = draft.productAggregates.find((item) => item.productId === aggregate.productId && item.published) || null;

  if (expectedGuard) {
    const currentGuard = buildPublicationGuard(currentPublished || {});
    const stale = currentGuard.aggregateVersion !== Number(expectedGuard.aggregateVersion || 0)
      || currentGuard.evidenceVersion !== Number(expectedGuard.evidenceVersion || 0)
      || (currentGuard.sourceSetHash || null) !== (expectedGuard.sourceSetHash || null)
      || (currentGuard.aggregateId || null) !== (expectedGuard.aggregateId || null);

    if (stale) {
      return {
        published: false,
        reason: 'STALE_PUBLICATION_REJECTED',
        currentPublished,
      };
    }
  }

  replaceProductAggregate(draft, aggregate);
  return {
    published: true,
    currentPublished,
  };
}

export function buildEmailSemanticState({
  draft,
  runtimeConfig,
  executionMode,
  freshnessStatus,
  usesLastKnownGood,
  reasonCodes = [],
  aggregateId,
  aggregateVersion,
  surface = 'product',
  latestAttemptAt = null,
  lastPublishedAt = null,
} = {}) {
  const trustState = computeSemanticTrustState({
    executionMode,
    lastPublishedAt,
    latestAttemptAt,
    reasonCodes,
    runtimeConfig,
    surface,
  });
  return {
    executionMode,
    policyMode: draft.semanticConfig?.executionMode || 'replay',
    sourceFamilyModes: draft.semanticConfig?.sourceFamilyModes || {},
    aggregateStatus: usesLastKnownGood ? 'degraded' : 'published',
    aggregateVersion,
    aggregateId,
    freshnessStatus,
    usesLastKnownGood,
    showBanner: trustState.showBanner,
    bannerTone: trustState.bannerTone,
    message: trustState.message,
    lastPublishedAt: trustState.lastPublishedAt,
    latestAttemptAt: trustState.latestAttemptAt,
    reasonCodes,
  };
}
