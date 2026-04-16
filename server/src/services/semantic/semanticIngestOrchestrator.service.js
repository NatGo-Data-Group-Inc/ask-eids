import { buildChunkArtifacts } from '../rag/chunking.service.js';
import { normalizeSourceArtifact } from './sourceNormalization.service.js';
import { extractSourceWithNova } from './novaSourceExtraction.service.js';
import { projectExtractionCitations } from './citationProjection.service.js';

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
  indexEvidence,
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

  const chunkArtifacts = buildChunkArtifacts({
    productId,
    sourceId,
    sourceType,
    sourceDate,
    title,
    author,
    participants: normalized.participants.length ? normalized.participants : participants,
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

  if (typeof indexEvidence === 'function') {
    await indexEvidence({
      chunks: chunkArtifacts.map((chunk) => ({
        sourceId,
        chunkIndex: chunk.chunkIndex,
        chunkText: chunk.chunkText,
        metadata: {
          ...chunk.metadata,
          application: 'AskEIDS',
          environment: process.env.NODE_ENV ?? 'development',
        },
      })),
    });
  }

  const { extraction, promptRun } = await extractSourceWithNova({
    normalized,
    executionDecision,
    runtimeConfig,
    testCase,
  });

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

  return {
    normalized,
    chunkArtifacts,
    extraction,
    promptRun,
    citationProjection,
    warningText,
    warnings,
    updatedDomains: ['sources', 'ask', 'reports'],
    latestAttemptAt: new Date().toISOString(),
  };
}
