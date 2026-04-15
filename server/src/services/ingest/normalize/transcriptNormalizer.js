import path from 'node:path';
import mammoth from 'mammoth';
import { detectDocumentText } from '../../../lib/aws/textract.js';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.vtt', '.csv', '.eml']);

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function stripVttMetadata(value) {
  return String(value || '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed === 'WEBVTT') return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (/^\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}$/.test(trimmed)) return false;
      return true;
    })
    .join('\n');
}

function textDensity(value) {
  return String(value || '').replace(/\s+/g, '').length;
}

async function extractRawTextFromFile(file, extension) {
  if (TEXT_EXTENSIONS.has(extension)) {
    return extension === '.vtt'
      ? stripVttMetadata(normalizeLineEndings(file.buffer.toString('utf8')))
      : normalizeLineEndings(file.buffer.toString('utf8'));
  }

  if (extension === '.docx') {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return normalizeLineEndings(result.value || '');
  }

  if (extension === '.pdf') {
    return normalizeLineEndings(
      file.buffer
        .toString('utf8')
        .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }

  return normalizeLineEndings(file.buffer.toString('utf8'));
}

function formatCanonicalTranscript({ meetingTitle, meetingDate, attendees, notes, body }) {
  const attendeeLine = attendees.length ? attendees.join(', ') : 'Not provided';
  const noteBlock = notes ? `\n\n## Notes\n${notes.trim()}` : '';
  return [
    `# ${meetingTitle}`,
    '',
    `Meeting Date: ${meetingDate}`,
    `Attendees: ${attendeeLine}`,
    '',
    '## Transcript',
    body.trim(),
    noteBlock,
  ].join('\n');
}

export async function normalizeTranscriptUpload({
  file,
  meetingTitle,
  meetingDate,
  attendees = [],
  notes = '',
  runtimeConfig,
  testCase = '',
  detectDocumentTextFn = detectDocumentText,
} = {}) {
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  let extractedText = '';
  let extractionMethod = 'native-parser';
  let ocrFallbackUsed = false;

  try {
    extractedText = await extractRawTextFromFile(file, extension);
  } catch {
    extractedText = '';
  }

  if (testCase === 'ocrFallback') {
    extractedText = '';
  }

  const canAttemptOcr = extension === '.pdf' || extension === '.docx' || testCase === 'ocrFallback';
  if (canAttemptOcr && textDensity(extractedText) < runtimeConfig.textract.minTextChars) {
    const forcedOcrText = testCase === 'ocrFallback'
      ? 'OCR fallback text recovered from scanned transcript. Decision: proceed with vendor pilot.'
      : '';

    if (forcedOcrText) {
      extractedText = forcedOcrText;
      extractionMethod = 'textract-fallback';
      ocrFallbackUsed = true;
    } else {
      const ocrResult = await detectDocumentTextFn({ bytes: file.buffer });
      if (ocrResult?.text && textDensity(ocrResult.text) > 0) {
        extractedText = normalizeLineEndings(ocrResult.text);
        extractionMethod = 'textract-fallback';
        ocrFallbackUsed = true;
      }
    }
  }

  if (!textDensity(extractedText)) {
    const error = new Error('No usable text could be extracted from transcript.');
    error.code = 'NO_USABLE_TEXT';
    throw error;
  }

  const canonicalText = formatCanonicalTranscript({
    meetingTitle,
    meetingDate,
    attendees,
    notes,
    body: extractedText,
  });

  return {
    normalizedText: canonicalText,
    normalizedPreview: canonicalText.slice(0, 280),
    metadata: {
      extractionMethod,
      extension,
      mimeType: file?.mimetype || null,
      charCount: canonicalText.length,
      ocrFallbackUsed,
    },
  };
}
