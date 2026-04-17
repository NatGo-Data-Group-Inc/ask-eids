import crypto from 'node:crypto';

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemToken(token) {
  return String(token || '')
    .replace(/ing$/i, '')
    .replace(/ed$/i, '')
    .replace(/es$/i, '')
    .replace(/s$/i, '');
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((token) => stemToken(token))
    .filter(Boolean);
}

function buildNormalizedQuestionHash(question) {
  return crypto.createHash('sha256').update(normalizeText(question)).digest('hex');
}

function sameField(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function sameValue(left, right) {
  return normalizeText(left) === normalizeText(right);
}

function detectExactFieldQuery(question, structuredHits) {
  const questionTokens = new Set(tokenize(question));
  return structuredHits.some((hit) => {
    if (hit.fieldValue === null || hit.fieldValue === undefined || !hit.matchedFieldName) {
      return false;
    }
    return tokenize(hit.matchedFieldName).some((token) => questionTokens.has(token));
  });
}

function buildStructuredSource(hit, { exactFieldQuery, exactFieldConflict }) {
  return {
    sourceId: hit.sourceId,
    sourceType: hit.sourceType,
    title: hit.title || hit.sourceType,
    meta: hit.meta || [hit.sourceDate ? String(hit.sourceDate).split('T')[0] : null, hit.sourceType].filter(Boolean).join(' - '),
    retrievalType: 'structured',
    precedenceNote: null,
    badge: exactFieldQuery ? 'field-of-record' : null,
    exactFieldConflict,
  };
}

function buildVectorSource(hit, { exactFieldQuery, exactFieldConflict }) {
  return {
    sourceId: hit.sourceId,
    sourceType: hit.sourceType,
    title: hit.title || hit.sourceType,
    meta: hit.meta || [hit.sourceDate ? String(hit.sourceDate).split('T')[0] : null, hit.sourceType].filter(Boolean).join(' - '),
    retrievalType: 'vector',
    precedenceNote: exactFieldQuery ? 'Cited for context; structured row is the field-of-record.' : null,
    conflictingFieldValue: exactFieldConflict ? hit.assertedFieldValue : undefined,
  };
}

function compareDateDesc(left, right) {
  const leftTime = left ? new Date(left).getTime() : -Infinity;
  const rightTime = right ? new Date(right).getTime() : -Infinity;
  return rightTime - leftTime;
}

function sortStructuredHits(structuredHits, { exactFieldQuery }) {
  return [...structuredHits].sort((left, right) => {
    const leftExact = exactFieldQuery && left.matchedFieldName ? 1 : 0;
    const rightExact = exactFieldQuery && right.matchedFieldName ? 1 : 0;
    if (leftExact !== rightExact) {
      return rightExact - leftExact;
    }
    if (left.matchConfidence !== right.matchConfidence) {
      return (right.matchConfidence || 0) - (left.matchConfidence || 0);
    }
    const dateDiff = compareDateDesc(left.sourceDate, right.sourceDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return String(left.sourceId).localeCompare(String(right.sourceId));
  });
}

function sortVectorHits(vectorHits) {
  return [...vectorHits].sort((left, right) => {
    if (left.score !== right.score) {
      return (right.score || 0) - (left.score || 0);
    }
    const dateDiff = compareDateDesc(left.sourceDate, right.sourceDate);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return String(left.sourceId).localeCompare(String(right.sourceId));
  });
}

export function askPrecedenceMerge({
  question,
  productId,
  structuredHits = [],
  vectorHits = [],
  productSourceIndex = [],
} = {}) {
  const exactFieldQuery = detectExactFieldQuery(question, structuredHits);
  const exactFieldConflict = exactFieldQuery && structuredHits.some((structuredHit) => (
    vectorHits.some((vectorHit) => (
      sameField(structuredHit.matchedFieldName, vectorHit.assertsFieldName)
        && !sameValue(structuredHit.fieldValue, vectorHit.assertedFieldValue)
    ))
  ));

  let winner = 'none';
  let resolution = 'no_evidence';
  let narrativeCitedForContext = false;

  if (exactFieldQuery) {
    winner = 'structured';
    resolution = exactFieldConflict ? 'structured_wins_conflict' : 'structured_wins_no_conflict';
    narrativeCitedForContext = vectorHits.length > 0;
  } else if (structuredHits.length > 0 && vectorHits.length > 0) {
    winner = 'merged';
    resolution = 'merged';
  } else if (structuredHits.length > 0) {
    winner = 'structured';
    resolution = 'structured_only';
  } else if (vectorHits.length > 0) {
    winner = 'vector';
    resolution = 'vector_only';
  }

  const orderedStructured = sortStructuredHits(structuredHits, { exactFieldQuery });
  const orderedVector = sortVectorHits(vectorHits);
  const sources = [
    ...orderedStructured.map((hit) => buildStructuredSource(hit, { exactFieldQuery, exactFieldConflict })),
    ...orderedVector.map((hit) => buildVectorSource(hit, { exactFieldQuery, exactFieldConflict })),
  ];

  const retrievalWarnings = productSourceIndex
    .filter((entry) => entry.sourceFamilyClass === 'retrieval_eligible')
    .filter((entry) => entry.productScopedTextMatch)
    .filter((entry) => ['disabled', 'failed', 'queued'].includes(entry.indexingStatus))
    .map((entry) => ({
      code: 'RETRIEVAL_NOT_READY',
      sourceId: entry.sourceId,
      indexingStatus: entry.indexingStatus,
    }));

  return {
    sources,
    decision: {
      question,
      questionHash: buildNormalizedQuestionHash(question),
      productId,
      structuredHits,
      vectorHits,
      resolution,
      exactFieldConflict,
      winner,
      narrativeCitedForContext,
    },
    retrievalWarnings,
  };
}
