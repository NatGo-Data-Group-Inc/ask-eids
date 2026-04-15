import path from 'node:path';

function tokenCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function splitIntoChunks(text, targetTokens = 650) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return [];
  }

  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = tokenCount(paragraph);
    if (current.length && currentTokens + paragraphTokens > targetTokens) {
      chunks.push(current.join('\n\n'));
      current = [paragraph];
      currentTokens = paragraphTokens;
    } else {
      current.push(paragraph);
      currentTokens += paragraphTokens;
    }
  }

  if (current.length) {
    chunks.push(current.join('\n\n'));
  }

  return chunks;
}

export function buildChunkArtifacts({
  productId,
  sourceId,
  sourceType,
  sourceDate,
  title,
  author,
  participants = [],
  environment = process.env.NODE_ENV ?? 'development',
  sensitivity = 'internal',
  text,
  targetTokens = 650,
} = {}) {
  const rawChunks = splitIntoChunks(text, targetTokens);
  return rawChunks.map((chunkText, index) => {
    const chunkNumber = String(index + 1).padStart(4, '0');
    const chunkKey = path.posix.join(productId, 'sources', sourceId, 'chunks', `chunk-${chunkNumber}.md`);
    const metadataKey = `${chunkKey}.metadata.json`;
    const metadata = {
      productId,
      sourceId,
      sourceType,
      sourceDate,
      title,
      author,
      participants,
      sectionHeading: index === 0 ? 'Transcript' : null,
      pageStart: null,
      pageEnd: null,
      threadId: null,
      sensitivity,
      environment,
    };
    return {
      chunkIndex: index,
      chunkText,
      chunkKey,
      metadataKey,
      metadata,
      tokenCount: tokenCount(chunkText),
    };
  });
}
