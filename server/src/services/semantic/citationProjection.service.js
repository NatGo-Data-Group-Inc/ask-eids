import { getSourceTypeDefinition } from '../../../../shared/artifactTypes.js';

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function buildFallbackCitation({ normalized, sourceType }) {
  const definition = getSourceTypeDefinition(sourceType);
  if (definition?.structured) {
    return {
      kind: 'row_range',
      sheetName: 'Sheet1',
      startRow: 1,
      endRow: 3,
      label: 'Rows 1-3',
      mode: 'fallback',
    };
  }

  const lineCount = Math.max(1, Math.min(normalized?.coordinateMap?.filter((line) => line.text !== undefined).length || 1, 4));
  return {
    kind: 'line_range',
    start: 1,
    end: lineCount,
    label: `Lines 1-${lineCount}`,
    mode: 'fallback',
  };
}

function projectAnchor(anchorText, coordinateMap) {
  const target = normalize(anchorText);
  if (!target) {
    return null;
  }
  const match = coordinateMap.find((line) => normalize(line.text).includes(target));
  if (!match) {
    return null;
  }
  return {
    kind: 'line_range',
    start: match.line,
    end: match.line,
    label: `Lines ${match.line}-${match.line}`,
    mode: 'exact',
  };
}

function dedupeCitations(citations) {
  const seen = new Set();
  return citations.filter((citation) => {
    const key = JSON.stringify(citation);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function projectExtractionCitations({
  extraction,
  normalized,
  sourceType,
} = {}) {
  const coordinateMap = Array.isArray(normalized?.coordinateMap) ? normalized.coordinateMap : [];
  if (!coordinateMap.length) {
    return {
      citationMode: 'fallback',
      citations: [buildFallbackCitation({ normalized, sourceType })],
      warningCodes: ['CITATION_FALLBACK'],
      decisions: Array.isArray(extraction?.decisions)
        ? extraction.decisions.map((decision) => ({
          ...decision,
          citation: buildFallbackCitation({ normalized, sourceType }),
        }))
        : [],
    };
  }

  const decisions = Array.isArray(extraction?.decisions) ? extraction.decisions : [];
  const projectedDecisions = decisions.map((decision) => {
    const citation = projectAnchor(decision.anchorText, coordinateMap) || buildFallbackCitation({ normalized, sourceType });
    return {
      ...decision,
      citation,
    };
  });
  const citations = dedupeCitations(projectedDecisions.map((decision) => decision.citation));
  const exactCount = citations.filter((citation) => citation.mode === 'exact').length;
  const citationMode = exactCount === citations.length
    ? 'exact'
    : exactCount > 0
      ? 'mixed'
      : 'fallback';
  const warningCodes = citationMode === 'exact' ? [] : ['CITATION_FALLBACK'];

  return {
    citationMode,
    citations: citations.length ? citations : [buildFallbackCitation({ normalized, sourceType })],
    warningCodes,
    decisions: projectedDecisions,
  };
}
