import { getEmbeddingDims } from '../../lib/aws/titanEmbeddings.js';
import { getRetrievalProvider } from '../../rag/retrievalProvider.js';
import { buildChunkArtifacts } from '../rag/chunking.service.js';

function buildIndexingError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function runChunkingAndIndexing({
  runtimeConfig,
  productId,
  sourceId,
  sourceType,
  sourceFamilyClass,
  sourceDate,
  title,
  author,
  participants = [],
  normalizedText,
  featureFlags,
  testCase = '',
} = {}) {
  if (sourceFamilyClass !== 'retrieval_eligible') {
    return {
      indexingStatus: 'not_applicable',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
      chunks: [],
      failureReason: null,
    };
  }

  if (!featureFlags?.enableDentalRetrievalIndexing) {
    return {
      indexingStatus: 'disabled',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
      chunks: [],
      failureReason: null,
    };
  }

  const chunks = buildChunkArtifacts({
    productId,
    sourceId,
    sourceType,
    sourceDate,
    title,
    author,
    participants,
    text: normalizedText,
  }).map((chunk) => ({
    ...chunk,
    chunkId: `${sourceId}::${chunk.chunkIndex}`,
  }));

  if (!chunks.length) {
    return {
      indexingStatus: 'failed',
      chunkCount: 0,
      embeddingDims: null,
      embeddingSource: 'none',
      chunks: [],
      failureReason: 'INDEXING_FAILED',
    };
  }

  if (testCase === 'embeddingFailure') {
    throw buildIndexingError('EMBEDDING_UNAVAILABLE', 'Embedding service unavailable for this source.');
  }
  if (testCase === 'indexFailure') {
    throw buildIndexingError('INDEXING_FAILED', 'DuckDB indexing failed for this source.');
  }

  const provider = await getRetrievalProvider();
  const result = await provider.replaceSourceDocuments({
    productId,
    sourceId,
    documents: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      docId: sourceId,
      text: chunk.chunkText,
      metadata: {
        ...chunk.metadata,
        productId,
        sourceId,
        sourceType,
        sourceDate,
        title,
        author,
        participants,
        chunkIndex: chunk.chunkIndex,
        application: 'AskEIDS',
        environment: process.env.NODE_ENV ?? 'development',
      },
    })),
  });

  return {
    indexingStatus: 'indexed',
    chunkCount: result.chunkCount,
    embeddingDims: result.embeddingDims ?? getEmbeddingDims(runtimeConfig),
    embeddingSource: result.embeddingSource,
    chunks: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      chunkIndex: chunk.chunkIndex,
      byteLength: Buffer.byteLength(chunk.chunkText, 'utf8'),
    })),
    failureReason: null,
  };
}
