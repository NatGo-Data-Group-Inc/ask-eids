const SOURCE_TYPES = {
  slide_deck: { label: 'slide deck', family: 'slide_deck', binary: true, structured: false },
  spreadsheet_attachment: { label: 'spreadsheet', family: 'spreadsheet', binary: true, structured: false },
  risk_export: { label: 'risk import', family: 'spreadsheet', binary: false, structured: true, dataset: 'risks' },
  blocker_export: { label: 'blocker import', family: 'spreadsheet', binary: false, structured: true, dataset: 'blockers' },
  pi_objectives_export: { label: 'PI objectives import', family: 'spreadsheet', binary: false, structured: true, dataset: 'pi' },
  action_item_export: { label: 'action item import', family: 'spreadsheet', binary: false, structured: true, dataset: 'actions' },
  ado_export: { label: 'ADO export', family: 'spreadsheet', binary: false, structured: true, dataset: 'ado' },
  document: { label: 'document', family: 'document', binary: false, structured: false },
  security_summary: { label: 'security summary', family: 'document', binary: false, structured: false },
  decision_memo: { label: 'decision memo', family: 'document', binary: false, structured: false },
  release_plan: { label: 'release plan', family: 'document', binary: false, structured: false },
  weekly_update: { label: 'weekly update', family: 'document', binary: false, structured: false },
  decision_log: { label: 'decision log', family: 'document', binary: false, structured: false },
  email: { label: 'email', family: 'email', binary: true, structured: false },
  transcript: { label: 'transcript', family: 'transcript', binary: false, structured: false },
  weekly: { label: 'weekly', family: 'document', binary: false, structured: false },
  ado: { label: 'ado', family: 'spreadsheet', binary: false, structured: false },
};

const EXTENSION_RULES = {
  '.pptx': { allowedTypes: ['slide_deck'], defaultType: 'slide_deck', locked: true, reviewRequired: false },
  '.xlsx': { allowedTypes: ['spreadsheet_attachment', 'risk_export', 'blocker_export', 'pi_objectives_export', 'action_item_export', 'ado_export'], defaultType: 'spreadsheet_attachment', locked: false, reviewRequired: true },
  '.csv': { allowedTypes: ['risk_export', 'blocker_export', 'pi_objectives_export', 'action_item_export', 'ado_export'], defaultType: '', locked: false, reviewRequired: true, requiresTypeSelection: true },
  '.pdf': { allowedTypes: ['document', 'security_summary'], defaultType: 'document', locked: false, reviewRequired: true },
  '.docx': { allowedTypes: ['document', 'decision_memo', 'release_plan', 'weekly_update', 'transcript'], defaultType: 'document', locked: false, reviewRequired: true },
  '.eml': { allowedTypes: ['email'], defaultType: 'email', locked: true, reviewRequired: false },
  '.md': { allowedTypes: ['document', 'weekly_update', 'decision_log', 'transcript'], defaultType: 'document', locked: false, reviewRequired: true },
  '.txt': { allowedTypes: ['document', 'transcript'], defaultType: 'document', locked: false, reviewRequired: true },
  '.vtt': { allowedTypes: ['transcript'], defaultType: 'transcript', locked: true, reviewRequired: false },
};

export function getArtifactExtension(fileName = '') {
  const lowered = String(fileName || '').toLowerCase();
  if (lowered.endsWith('.metadata.json')) {
    return '.metadata.json';
  }
  const match = lowered.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

export function getArtifactRule(fileName = '') {
  return EXTENSION_RULES[getArtifactExtension(fileName)] || null;
}

export function getAllowedSourceTypes(fileName = '') {
  return getArtifactRule(fileName)?.allowedTypes || [];
}

export function getDefaultSourceType(fileName = '') {
  return getArtifactRule(fileName)?.defaultType || '';
}

export function isSupportedArtifactFile(fileName = '') {
  return Boolean(getArtifactRule(fileName));
}

export function isMetadataFile(fileName = '') {
  return getArtifactExtension(fileName) === '.metadata.json';
}

export function getSourceTypeDefinition(sourceType = '') {
  return SOURCE_TYPES[sourceType] || null;
}

export function isStructuredImportType(sourceType = '') {
  return Boolean(SOURCE_TYPES[sourceType]?.structured);
}

export function isBinarySourceType(sourceType = '') {
  return Boolean(SOURCE_TYPES[sourceType]?.binary);
}

export function getSourceFamily(sourceType = '') {
  return SOURCE_TYPES[sourceType]?.family || 'document';
}

export function getSourceTypeLabel(sourceType = '') {
  return SOURCE_TYPES[sourceType]?.label || sourceType || 'source';
}

export function isSourceTypeAllowedForFile(fileName = '', sourceType = '') {
  const rule = getArtifactRule(fileName);
  return Boolean(rule && rule.allowedTypes.includes(sourceType));
}

export function getSourceTypeOptions(fileName = '') {
  return getAllowedSourceTypes(fileName).map((value) => ({ value, label: getSourceTypeLabel(value) }));
}

export function getFilterKeyForSourceType(sourceType = '') {
  const family = getSourceFamily(sourceType);
  if (family === 'slide_deck') {
    return 'slide_deck';
  }
  if (family === 'spreadsheet') {
    return 'spreadsheet';
  }
  if (sourceType === 'transcript') {
    return 'transcript';
  }
  if (sourceType === 'email') {
    return 'email';
  }
  if (sourceType === 'weekly') {
    return 'weekly';
  }
  if (sourceType === 'ado') {
    return 'ado';
  }
  return 'document';
}

export function buildArtifactTitle(fileName = '') {
  const baseName = String(fileName || '').replace(/\.metadata\.json$/i, '').replace(/\.[^.]+$/, '');
  return baseName
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

export const ARTIFACT_MAX_BYTES = 25 * 1024 * 1024;
export const SOURCE_TYPE_DEFINITIONS = SOURCE_TYPES;
export const SUPPORTED_ARTIFACT_EXTENSIONS = Object.keys(EXTENSION_RULES);
