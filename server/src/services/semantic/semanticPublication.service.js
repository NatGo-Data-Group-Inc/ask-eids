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
    featureMode: draft.semanticConfig?.featureMode || 'extraction-first',
    aggregateId,
    freshnessStatus,
    usesLastKnownGood,
    message: trustState.message,
    lastPublishedAt: trustState.lastPublishedAt,
    latestAttemptAt: trustState.latestAttemptAt,
    reasonCodes,
  };
}
