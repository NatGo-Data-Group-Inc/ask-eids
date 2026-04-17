import { normalizeSourceArtifact } from './sourceNormalization.service.js';
import { extractSourceWithNova } from './novaSourceExtraction.service.js';
import { projectExtractionCitations } from './citationProjection.service.js';
import { runChunkingAndIndexing } from './chunkingAndIndexing.service.js';
import { getSourceFamilyClass } from '../../../../shared/artifactTypes.js';

const FALLBACK_CITATION_MESSAGE = 'Exact coordinates were unavailable for this source. Showing the best available reference.';

export async function runEmailSemanticIngest({
  artifactStore,
  normalizedArtifactKey,
  file,
  sourceType,
  sourceId,
  productId,
  title,
  sourceDate,
  author,
  participants = [],
  executionDecision,
  runtimeConfig,
  testCase = '',
  featureFlags,
} = {}) {
  const normalized = await normalizeSourceArtifact({
    file,
    sourceType,
    sourceId,
    productId,
    title,
    sourceDate,
    testCase,
  });

  await artifactStore.writeTextArtifact({
    bucketType: 'normalized',
    key: normalizedArtifactKey,
    content: normalized.normalizedText,
    contentType: 'text/plain; charset=utf-8',
  });

  const { extraction, promptRun } = await extractSourceWithNova({
    normalized,
    executionDecision,
    runtimeConfig,
    testCase,
  });

  const sourceFamilyClass = getSourceFamilyClass(sourceType);
  const citationProjection = projectExtractionCitations({
    extraction,
    normalized,
    sourceType,
  });

  const warningText = citationProjection.citationMode === 'exact'
    ? null
    : FALLBACK_CITATION_MESSAGE;
  const warnings = [
    ...(Array.isArray(extraction.warnings) ? extraction.warnings : []),
    ...(warningText ? [warningText] : []),
  ];
  let indexingResult;
  try {
    indexingResult = await runChunkingAndIndexing({
      runtimeConfig,
      productId,
      sourceId,
      sourceType,
      sourceFamilyClass,
      sourceDate,
      title,
      author,
      participants: normalized.participants.length ? normalized.participants : participants,
      normalizedText: normalized.normalizedText,
      featureFlags,
      testCase,
    });
  } catch (error) {
    if (!['EMBEDDING_UNAVAILABLE', 'INDEXING_FAILED'].includes(error?.code)) {
      throw error;
    }
    indexingResult = {
      indexingStatus: 'failed',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
      chunks: [],
      failureReason: error.code,
    };
  }

  return {
    normalized,
    extraction,
    promptRun,
    sourceFamilyClass,
    citationProjection,
    warningText,
    warnings,
    indexingResult,
    updatedDomains: ['sources', 'ask', 'reports'],
    latestAttemptAt: new Date().toISOString(),
  };
}
