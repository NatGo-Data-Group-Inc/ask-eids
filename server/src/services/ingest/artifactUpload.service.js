import { HttpError } from '../common/httpError.js';
import {
  ARTIFACT_MAX_BYTES,
  buildArtifactTitle,
  getArtifactRule,
  getFilterKeyForSourceType,
  getSourceFamily,
  getSourceTypeDefinition,
  getSourceTypeLabel,
  isBinarySourceType,
  isStructuredImportType,
  isSupportedArtifactFile,
  isSourceTypeAllowedForFile,
} from '../../../../shared/artifactTypes.js';

function todayUtcDate() {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
}

function safeText(buffer) {
  return Buffer.from(buffer || '').toString('utf8').replace(/\r\n/g, '\n');
}

function trimLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseMetadataFile(metadataFile) {
  if (!metadataFile) {
    return null;
  }
  try {
    return JSON.parse(safeText(metadataFile.buffer));
  } catch {
    return { __invalid: true };
  }
}

export function validateArtifactUpload({ body, file, metadataFile, errorCodes }) {
  const sourceDate = String(body.sourceDate || body.meetingDate || '').trim();
  const sourceType = String(body.sourceType || '').trim();
  const selectedTitle = String(body.title || body.meetingTitle || '').trim();

  if (!file) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose an artifact file', { field: 'file' });
  }
  if (!isSupportedArtifactFile(file.originalname)) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'File type not supported', { field: 'file' });
  }
  if (file.size > ARTIFACT_MAX_BYTES) {
    throw new HttpError(413, errorCodes.PAYLOAD_TOO_LARGE, 'File exceeds the allowed size limit', { field: 'file' });
  }
  if (!sourceDate) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose a source date', { field: 'sourceDate' });
  }
  const dateValue = new Date(`${sourceDate}T00:00:00Z`);
  if (!Number.isNaN(dateValue.getTime()) && dateValue.getTime() > todayUtcDate().getTime()) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Source date cannot be in the future', { field: 'sourceDate' });
  }

  const rule = getArtifactRule(file.originalname);
  const resolvedType = sourceType || rule?.defaultType || '';
  if (!resolvedType) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose a source type', { field: 'sourceType' });
  }
  if (!isSourceTypeAllowedForFile(file.originalname, resolvedType)) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Choose a source type', { field: 'sourceType' });
  }
  if (isStructuredImportType(resolvedType) && String(body.structuredImpactConfirmed || '') !== 'true') {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Confirm that this upload updates structured product data', { field: 'structuredImpactConfirmed' });
  }

  const parsedMetadata = parseMetadataFile(metadataFile);
  if (parsedMetadata?.__invalid) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Metadata file conflicts with the selected product or source type', { field: 'metadataFile' });
  }
  if (parsedMetadata && ((parsedMetadata.productId && parsedMetadata.productId !== body.productId) || (parsedMetadata.sourceType && parsedMetadata.sourceType !== resolvedType))) {
    throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Metadata file conflicts with the selected product or source type', { field: 'metadataFile' });
  }

  return {
    sourceDate,
    sourceType: resolvedType,
    title: selectedTitle || buildArtifactTitle(file.originalname),
    author: String(body.author || '').trim(),
    participants: String(body.participants || '').trim(),
    notes: String(body.notes || '').trim(),
    metadata: parsedMetadata || null,
  };
}

export function buildTestSourceId(fileName, fallbackId) {
  const lowered = String(fileName || '').toLowerCase();
  if (lowered.includes('recovery-deck')) {
    return 'src-uploaded-deck';
  }
  if (lowered.includes('risks-import')) {
    return 'src-uploaded-risks';
  }
  return fallbackId;
}

function buildSlideDeckPreview(lines) {
  return lines.slice(0, 12).join('\n');
}

function buildSpreadsheetPreview(lines) {
  return lines.slice(0, 11).join('\n');
}

function buildEmailPreview(lines) {
  return lines.slice(0, 8).join('\n');
}

function buildDocumentPreview(lines) {
  return lines.slice(0, 10).join('\n');
}

function buildTranscriptPreview(lines) {
  return lines.slice(0, 10).join('\n');
}

export function extractArtifactContent({ file, sourceType, testCase = '' }) {
  const text = safeText(file.buffer);
  const lines = trimLines(text);
  const family = getSourceFamily(sourceType);
  let previewText = buildDocumentPreview(lines);

  if (family === 'slide_deck') {
    previewText = buildSlideDeckPreview(lines);
  } else if (family === 'spreadsheet') {
    previewText = buildSpreadsheetPreview(lines);
  } else if (family === 'email') {
    previewText = buildEmailPreview(lines);
  } else if (sourceType === 'transcript') {
    previewText = buildTranscriptPreview(lines);
  }

  const warningText = testCase === 'artifactPartial'
    ? 'This artifact was processed, but some content could not be fully extracted. Review the source before relying on it for critical decisions.'
    : null;

  return {
    normalizedText: text,
    previewText: previewText || text.slice(0, 400),
    warningText,
    metadata: {
      previewMode: family,
      binary: isBinarySourceType(sourceType),
      sourceFamily: family,
      sourceTypeLabel: getSourceTypeLabel(sourceType),
    },
  };
}

function parseCsvRow(line) {
  return line.split(',').map((value) => value.trim());
}

export function parseStructuredImportRows({ sourceType, text }) {
  const definition = getSourceTypeDefinition(sourceType);
  if (!definition?.dataset || !text.trim()) {
    return null;
  }
  const [headerLine, ...rowLines] = trimLines(text);
  const headers = parseCsvRow(headerLine || '');
  const rows = rowLines.map(parseCsvRow).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));

  if (definition.dataset === 'risks') {
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      severity: row.severity || 'med',
      status: row.status || 'open',
      owner: row.owner || 'Unassigned',
      changed: row.changed || new Date().toISOString(),
      description: row.description || 'Imported risk row.',
      mitigation: row.mitigation || 'Review imported mitigation.',
      relatedEvents: ['Imported from artifact upload'],
    }));
  }

  return rows;
}

export function buildSourceSummary({ sourceType, sourceDate, title, author, participants, warningText, processingStatus }) {
  const typeLabel = getSourceTypeLabel(sourceType);
  const participantCount = participants.length ? `${participants.length} participants` : null;
  const statusLabel = processingStatus === 'completed'
    ? 'Processed'
    : processingStatus === 'partial'
      ? 'Processed with limitations'
      : processingStatus === 'failed'
        ? 'Processing failed'
        : processingStatus === 'running'
          ? 'Processing'
          : 'Queued';
  return {
    meta: [sourceDate, typeLabel, participantCount, statusLabel].filter(Boolean).join(' · '),
    warningText,
    actionLabel: isBinarySourceType(sourceType) ? 'Download Original' : 'Open Source',
    filterKey: getFilterKeyForSourceType(sourceType),
  };
}
