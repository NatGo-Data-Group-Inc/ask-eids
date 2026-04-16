function hoursSince(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }
  return (Date.now() - date.getTime()) / 3600000;
}

export function buildSemanticTrustMessage({
  executionMode,
  freshnessStatus,
  usesLastKnownGood,
  reasonCodes = [],
  surface = 'product',
} = {}) {
  if (surface === 'ask' && usesLastKnownGood) {
    return 'This answer is using the last published product understanding while newer evidence is still being validated.';
  }
  if (surface === 'report' && usesLastKnownGood) {
    return 'This report reflects the last published product understanding. Regenerate after the current evidence refresh completes.';
  }
  if (reasonCodes.includes('publication_failed')) {
    return 'This source was stored, but product understanding was not refreshed. Last known good state remains active.';
  }
  if (freshnessStatus === 'stale') {
    return 'The latest published product understanding is getting stale.';
  }
  if (executionMode === 'live') {
    return 'Live AI extraction completed and the latest product understanding is active.';
  }
  return 'AI extraction completed in replay mode. New evidence is now available across Sources, Ask, and reports.';
}

export function computeSemanticTrustState({
  executionMode = 'replay',
  lastPublishedAt = null,
  latestAttemptAt = null,
  reasonCodes = [],
  runtimeConfig = null,
  surface = 'product',
} = {}) {
  const staleAfterHours = Number(runtimeConfig?.semantic?.staleAfterHours || 24);
  const usesLastKnownGood = reasonCodes.includes('publication_failed') || reasonCodes.includes('using_last_known_good');
  let freshnessStatus = usesLastKnownGood ? 'degraded' : 'fresh';

  if (!usesLastKnownGood && hoursSince(lastPublishedAt) > staleAfterHours) {
    freshnessStatus = 'stale';
  }

  return {
    executionMode,
    freshnessStatus,
    isDegraded: freshnessStatus === 'degraded',
    usesLastKnownGood,
    message: buildSemanticTrustMessage({
      executionMode,
      freshnessStatus,
      usesLastKnownGood,
      reasonCodes,
      surface,
    }),
    lastPublishedAt,
    latestAttemptAt: latestAttemptAt || lastPublishedAt,
    reasonCodes,
  };
}
