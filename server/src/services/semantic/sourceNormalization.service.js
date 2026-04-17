import path from 'node:path';
import mammoth from 'mammoth';
import AdmZip from 'adm-zip';
import { simpleParser } from 'mailparser';
import { getSourceFamily } from '../../../../shared/artifactTypes.js';
import { extractArtifactContent } from '../ingest/artifactUpload.service.js';

function extractTextFromSlideXml(xml) {
  // PowerPoint slide XML wraps visible text in <a:t>…</a:t> runs. Grabbing those gives
  // readable prose. Also decode common XML entities.
  const runs = String(xml || '').match(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g) || [];
  return runs
    .map((run) => run.replace(/<a:t[^>]*>/, '').replace(/<\/a:t>/, ''))
    .map((text) => text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'"))
    .join(' ');
}

function extractTextFromPptxBuffer(buffer) {
  const zip = new AdmZip(buffer);
  const slideEntries = zip
    .getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
    .sort((a, b) => {
      const numA = Number.parseInt(a.entryName.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
      const numB = Number.parseInt(b.entryName.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
      return numA - numB;
    });
  return slideEntries
    .map((entry, index) => {
      const text = extractTextFromSlideXml(entry.getData().toString('utf8'));
      return `Slide ${index + 1}: ${text}`.trim();
    })
    .filter(Boolean)
    .join('\n\n');
}

async function decodeBinaryArtifactToTextBuffer(file) {
  const originalName = file?.originalname || '';
  const extension = path.extname(originalName).toLowerCase();
  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return { ...file, buffer: Buffer.from(result.value || '', 'utf8') };
  }
  if (extension === '.pdf') {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
    const result = await parser.getText();
    return { ...file, buffer: Buffer.from(result.text || '', 'utf8') };
  }
  if (extension === '.pptx') {
    const text = extractTextFromPptxBuffer(file.buffer);
    return { ...file, buffer: Buffer.from(text, 'utf8') };
  }
  return file;
}

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
    const decodedFile = await decodeBinaryArtifactToTextBuffer(file);
    const extracted = extractArtifactContent({ file: decodedFile, sourceType, testCase });
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
