import { getSourceFamily } from '../../../../shared/artifactTypes.js';
import { resolveEffectiveFeatureFlags } from './featureFlags.service.js';

const KNOWN_SOURCE_FAMILIES = ['email', 'document', 'transcript', 'spreadsheet', 'slide_deck'];

export function buildSourceFamilyModes({
  executionMode = 'replay',
  liveSourceFamilies = ['email'],
} = {}) {
  const modes = Object.fromEntries(KNOWN_SOURCE_FAMILIES.map((family) => [family, 'replay']));
  if (executionMode === 'hybrid' || executionMode === 'live') {
    for (const family of liveSourceFamilies) {
      modes[family] = 'live';
    }
  }
  return modes;
}

export function resolveSemanticExecutionPolicy({
  productId,
  sourceType,
  sourceFamily = getSourceFamily(sourceType),
  runtimeConfig,
  stateSemanticConfig = {},
} = {}) {
  const semanticConfig = stateSemanticConfig || {};
  const effectiveFeatureFlags = resolveEffectiveFeatureFlags({
    runtimeConfig,
    persistedSemanticConfig: semanticConfig,
  });
  const sourceFamilyModes = semanticConfig.sourceFamilyModes
    || buildSourceFamilyModes({
      executionMode: semanticConfig.executionMode || runtimeConfig?.semantic?.defaultExecutionMode || 'replay',
      liveSourceFamilies: runtimeConfig?.semantic?.liveSourceFamilies || ['email'],
    });
  const requestedMode = sourceFamilyModes[sourceFamily]
    || runtimeConfig?.semantic?.defaultExecutionMode
    || 'replay';
  const liveSupported = Boolean(
    productId === 'dental'
      && requestedMode === 'live'
      && effectiveFeatureFlags.enableNovaDentalLiveEmail
      && runtimeConfig?.bedrock?.enabled
      && runtimeConfig?.bedrock?.textModelId
      && (runtimeConfig?.semantic?.liveSourceFamilies || []).includes(sourceFamily)
  );

  let executionMode = requestedMode;
  let reason = 'configured_execution_mode';
  let disabled = false;
  if (productId !== 'dental') {
    executionMode = 'replay';
    reason = 'non_dental_replay';
  } else if (requestedMode === 'replay' && !effectiveFeatureFlags.enableExtractionReplayMode) {
    executionMode = 'disabled';
    reason = 'replay_disabled';
    disabled = true;
  } else if (requestedMode === 'live' && !liveSupported) {
    executionMode = 'replay';
    reason = 'live_unavailable_replay_fallback';
  } else if (requestedMode === 'live') {
    reason = 'feature_flag_enabled_for_family';
  }

  return {
    productId,
    sourceType,
    sourceFamily,
    executionMode,
    requestedMode,
    reason,
    disabled,
    promptVersion: runtimeConfig?.semantic?.promptRegistryVersion || 'local-dev',
    featureFlags: effectiveFeatureFlags,
  };
}

export { KNOWN_SOURCE_FAMILIES };
