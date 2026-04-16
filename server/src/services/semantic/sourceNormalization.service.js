import { simpleParser } from 'mailparser';
import { getSourceFamily } from '../../../../shared/artifactTypes.js';
import { extractArtifactContent } from '../ingest/artifactUpload.service.js';

function buildCoordinateMap(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let offset = 0;
  return lines.map((line, index) => {
    const entry = {
      line: index + 1,
      text: line,
      offsetStart: offset,
      offsetEnd: offset + line.length,
    };
    offset += line.length + 1;
    return entry;
  });
}

function firstMeaningfulBodyLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !/^subject:/i.test(line) && !/^from:/i.test(line) && !/^to:/i.test(line) && !/^cc:/i.test(line) && !/^date:/i.test(line))
    || '';
}

function parseDisplayNames(addressLike) {
  const values = addressLike?.value || [];
  return values
    .map((entry) => entry.name || entry.address)
    .filter(Boolean);
}

export async function normalizeSourceArtifact({
  file,
  sourceType,
  sourceId,
  productId,
  title,
  sourceDate,
  testCase = '',
} = {}) {
  const sourceFamily = getSourceFamily(sourceType);

  if (sourceType !== 'email') {
    const extracted = extractArtifactContent({ file, sourceType, testCase });
    return {
      sourceId,
      productId,
      sourceType,
      sourceFamily,
      title,
      sourceDate,
      normalizedText: extracted.normalizedText,
      coordinateMap: buildCoordinateMap(extracted.normalizedText),
      lineCount: buildCoordinateMap(extracted.normalizedText).length,
      previewText: extracted.previewText,
      normalizationVersion: '2026-04-16-generic-v1',
      normalizationMeta: extracted.metadata || {},
      warningText: extracted.warningText || null,
      participants: [],
    };
  }

  const parsed = await simpleParser(file.buffer);
  const bodyText = String(parsed.text || '').replace(/\r\n/g, '\n').trim();
  const normalizedLines = [
    parsed.subject ? `Subject: ${parsed.subject}` : null,
    parsed.from?.text ? `From: ${parsed.from.text}` : null,
    parsed.to?.text ? `To: ${parsed.to.text}` : null,
    parsed.cc?.text ? `Cc: ${parsed.cc.text}` : null,
    parsed.date ? `Date: ${parsed.date.toISOString()}` : null,
    '',
    bodyText,
  ].filter((line) => line !== null);
  const normalizedText = normalizedLines.join('\n');
  const coordinateMap = buildCoordinateMap(normalizedText);

  return {
    sourceId,
    productId,
    sourceType,
    sourceFamily,
    title,
    sourceDate,
    normalizedText,
    coordinateMap,
    lineCount: coordinateMap.length,
    previewText: firstMeaningfulBodyLine(normalizedText) || title,
    normalizationVersion: '2026-04-16-email-v1',
    normalizationMeta: {
      format: 'eml',
      from: parsed.from?.text || '',
      to: parseDisplayNames(parsed.to),
      cc: parseDisplayNames(parsed.cc),
      subject: parsed.subject || title,
    },
    warningText: null,
    participants: [
      ...parseDisplayNames(parsed.from),
      ...parseDisplayNames(parsed.to),
      ...parseDisplayNames(parsed.cc),
    ].filter((value, index, array) => array.indexOf(value) === index),
  };
}

export { buildCoordinateMap };
