function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function getDefaultEffectiveFeatureFlags(runtimeConfig) {
  return {
    enableNovaDentalLiveEmail: Boolean(runtimeConfig?.features?.enableNovaDentalLiveEmail),
    enableDentalTrustSurfaces: Boolean(runtimeConfig?.features?.enableDentalTrustSurfaces),
    enableSemanticServicePath: Boolean(runtimeConfig?.features?.enableSemanticServicePath),
    enableExtractionReplayMode: Boolean(runtimeConfig?.features?.enableExtractionReplayMode),
    enableDentalRetrievalIndexing: Boolean(runtimeConfig?.features?.enableDentalRetrievalIndexing),
  };
}

export function featureFlagsFromLegacyMode(featureMode, defaults) {
  if (!featureMode) {
    return { ...defaults };
  }

  const mapped = { ...defaults };
  const normalized = String(featureMode).trim();
  if (normalized === 'legacy') {
    mapped.enableDentalTrustSurfaces = false;
    mapped.enableSemanticServicePath = false;
  } else if (normalized === 'extraction-first') {
    mapped.enableDentalTrustSurfaces = true;
    mapped.enableSemanticServicePath = false;
  } else if (normalized === 'live-email-trust-hardening') {
    mapped.enableDentalTrustSurfaces = true;
    mapped.enableSemanticServicePath = true;
  } else if (normalized === 'service-split') {
    mapped.enableDentalTrustSurfaces = true;
    mapped.enableSemanticServicePath = true;
  }
  return mapped;
}

export function resolveEffectiveFeatureFlags({
  runtimeConfig,
  persistedSemanticConfig = {},
  overrideFeatureFlags = null,
  legacyFeatureMode = '',
} = {}) {
  const defaults = getDefaultEffectiveFeatureFlags(runtimeConfig);
  const persisted = persistedSemanticConfig?.featureFlags && typeof persistedSemanticConfig.featureFlags === 'object'
    ? persistedSemanticConfig.featureFlags
    : featureFlagsFromLegacyMode(persistedSemanticConfig?.featureMode || legacyFeatureMode, defaults);
  const override = overrideFeatureFlags && typeof overrideFeatureFlags === 'object'
    ? overrideFeatureFlags
    : null;

  const merged = {
    ...defaults,
    ...persisted,
    ...override,
  };

  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [key, normalizeBoolean(merged[key], defaultValue)])
  );
}
