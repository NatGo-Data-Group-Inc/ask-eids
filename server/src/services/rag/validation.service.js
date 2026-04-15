function normalizeSourceIds(sourceIds = []) {
  return [...new Set(sourceIds.map((item) => String(item || '').trim()).filter(Boolean))];
}

export function validateAskGeneration({ payload, allowedSourceIds = [] } = {}) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('Generation payload missing.');
    error.code = 'INVALID_GENERATION_PAYLOAD';
    throw error;
  }
  if (!['complete', 'partial', 'insufficientEvidence'].includes(payload.status)) {
    const error = new Error('Generation payload has invalid status.');
    error.code = 'INVALID_GENERATION_STATUS';
    throw error;
  }
  if (typeof payload.answerHtml !== 'string' || !payload.answerHtml.trim()) {
    const error = new Error('Generation payload is missing answerHtml.');
    error.code = 'INVALID_GENERATION_ANSWER';
    throw error;
  }
  if (!Array.isArray(payload.sourceIds)) {
    const error = new Error('Generation payload is missing sourceIds.');
    error.code = 'INVALID_GENERATION_SOURCES';
    throw error;
  }

  const normalizedAllowed = new Set(normalizeSourceIds(allowedSourceIds));
  const normalizedSources = normalizeSourceIds(payload.sourceIds);
  const unknownSourceId = normalizedSources.find((sourceId) => !normalizedAllowed.has(sourceId));
  if (unknownSourceId) {
    const error = new Error(`Generation output referenced unknown sourceId: ${unknownSourceId}`);
    error.code = 'UNKNOWN_SOURCE_CITATION';
    throw error;
  }

  return {
    ...payload,
    sourceIds: normalizedSources,
  };
}
