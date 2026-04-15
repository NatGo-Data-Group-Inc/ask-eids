
import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';

const corpusRoot = path.resolve('EIDS-Prototype-Document-Pack');
const manifestPath = path.join(corpusRoot, '00-operator-guide', 'MASTER-MANIFEST.csv');
const fixedSessionUser = {
  sub: 'user-123',
  displayName: 'B. Jennings',
  email: 'bjennings@example.mil',
};
const fixedRolePresets = {
  lead: { role: 'lead', canUploadArtifact: true, canUploadTranscript: true, canUpdateWeekly: true, canEditReport: true, canExportReport: true },
  editor: { role: 'editor', canUploadArtifact: true, canUploadTranscript: true, canUpdateWeekly: true, canEditReport: true, canExportReport: true },
  read: { role: 'read', canUploadArtifact: false, canUploadTranscript: false, canUpdateWeekly: false, canEditReport: false, canExportReport: true },
};
const binaryFallbackFormats = new Set(['pdf', 'pptx', 'xlsx']);
const textLikeFormats = new Set(['md', 'csv', 'eml']);
const waveOrder = ['wave-00-baseline', 'wave-01-operational', 'wave-02-escalation', 'wave-03-recovery'];

function parseCsv(text) {
  const rows = [];
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) {
    return rows;
  }

  function splitCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (inQuotes && line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (character === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += character;
      }
    }
    values.push(current);
    return values.map((value) => value.trim());
  }

  const headers = splitCsvLine(lines[0]);
  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function stripFrontMatter(text) {
  const value = String(text || '');
  if (!value.startsWith('---')) {
    return value.trim();
  }
  const match = value.match(/^---\s*[\r\n]+([\s\S]*?)\n---\s*[\r\n]*/);
  if (!match) {
    return value.trim();
  }
  return value.slice(match[0].length).trim();
}

function parseFrontMatter(text) {
  const value = String(text || '');
  if (!value.startsWith('---')) {
    return {};
  }
  const match = value.match(/^---\s*[\r\n]+([\s\S]*?)\n---\s*[\r\n]*/);
  if (!match) {
    return {};
  }
  const attributes = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    attributes[key] = rawValue;
  }
  return attributes;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeQuotedPrintable(text) {
  return String(text || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([A-F0-9]{2})/gi, (_match, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function normalizeWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractFirstMeaningfulLine(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('#') && !line.startsWith('---') && !line.startsWith('**')) ?? '';
}

function extractStakeholders(text) {
  const matches = [...String(text || '').matchAll(/^###\s+([^\n—-]+)/gm)];
  return matches.map((match) => match[1].trim()).filter(Boolean);
}

function extractMarkdownSection(text, heading) {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const match = String(text || '').match(pattern);
  return match ? match[1].trim() : '';
}

function extractBulletItems(text, heading) {
  const section = extractMarkdownSection(text, heading);
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function parseWeeklyContent(text) {
  return {
    summary: normalizeWhitespace(extractMarkdownSection(text, 'Executive Summary')),
    accomplishments: extractBulletItems(text, 'Accomplishments This Period').join('; '),
    risks: extractBulletItems(text, 'Risks / Concerns').join('; '),
    nextSteps: extractBulletItems(text, 'Next 7 Days').join('; '),
    dataQualityNote: normalizeWhitespace(extractMarkdownSection(text, 'Data Quality Note')),
    weekEnding: normalizeWhitespace(extractMarkdownSection(text, 'Week Ending')).split(/\s+/)[0] || null,
  };
}

function parseTranscriptContent(text) {
  const attendeesMatch = String(text || '').match(/\*\*Attendees:\*\*\s*([^\n]+)/i);
  const timeMatch = String(text || '').match(/\*\*Date\s*\/\s*Time:\*\*\s*([^\n]+)/i);
  return {
    attendees: attendeesMatch ? attendeesMatch[1].split(',').map((item) => item.trim()).filter(Boolean) : [],
    decisions: extractBulletItems(text, 'Decisions Captured'),
    actionItems: extractBulletItems(text, 'Action Items'),
    meetingSummary: normalizeWhitespace(extractMarkdownSection(text, 'Meeting Summary')),
    timeLabel: timeMatch ? timeMatch[1].trim() : '',
  };
}

function parseEmailContent(text) {
  const [rawHeaders, ...bodyParts] = String(text || '').split(/\r?\n\r?\n/);
  const headers = {};
  let currentHeader = '';
  for (const line of String(rawHeaders || '').split(/\r?\n/)) {
    if (/^\s/.test(line) && currentHeader) {
      headers[currentHeader] = `${headers[currentHeader]} ${line.trim()}`;
      continue;
    }
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    currentHeader = line.slice(0, separator).trim();
    headers[currentHeader] = line.slice(separator + 1).trim();
  }

  const body = decodeQuotedPrintable(bodyParts.join('\n\n')).trim();
  const previewLine = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .find((line) => line && !['team,', 'team'].includes(line.toLowerCase())) ?? '';

  function extractDisplayNames(headerValue) {
    return String(headerValue || '')
      .split(',')
      .map((part) => {
        const nameMatch = part.match(/([^<]+)</);
        return (nameMatch ? nameMatch[1] : part).trim();
      })
      .filter(Boolean);
  }

  const participants = [
    ...extractDisplayNames(headers.From),
    ...extractDisplayNames(headers.To),
    ...extractDisplayNames(headers.Cc),
  ].filter((value, index, array) => array.indexOf(value) === index);

  const sentAt = headers.Date ? new Date(headers.Date) : null;
  return {
    headers,
    body,
    previewLine,
    participants,
    sentAt,
    timeLabel: sentAt && !Number.isNaN(sentAt.getTime())
      ? sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : '',
  };
}

function mapStatusSignal(signal) {
  const normalized = String(signal || '').toLowerCase();
  if (normalized === 'healthy') {
    return 'healthy';
  }
  if (normalized === 'risk') {
    return 'risk';
  }
  if (normalized === 'caution') {
    return 'caution';
  }
  return 'caution';
}

function labelForStatus(status) {
  if (status === 'healthy') {
    return 'On Track';
  }
  if (status === 'risk') {
    return 'At Risk';
  }
  return 'Caution';
}

function sourceTypeToUiType(sourceType) {
  if (sourceType === 'email') {
    return 'email';
  }
  if (sourceType === 'transcript') {
    return 'transcript';
  }
  if (sourceType === 'weekly_update') {
    return 'weekly';
  }
  if (sourceType === 'ado_export') {
    return 'ado';
  }
  return 'document';
}

function sourceTypeToTimelineType(sourceType) {
  if (sourceType === 'email') {
    return 'email';
  }
  if (sourceType === 'transcript') {
    return 'transcript';
  }
  if (sourceType === 'weekly_update') {
    return 'weekly';
  }
  if (sourceType === 'risk_export') {
    return 'risk';
  }
  if (sourceType === 'blocker_export') {
    return 'blocker';
  }
  if (sourceType === 'ado_export') {
    return 'ado';
  }
  if (['decision_memo', 'decision_log', 'release_plan', 'roadmap'].includes(sourceType)) {
    return 'decision';
  }
  return 'document';
}

function severityClass(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.startsWith('high')) {
    return 'high';
  }
  if (normalized.startsWith('med')) {
    return 'med';
  }
  if (normalized.startsWith('low')) {
    return 'low';
  }
  return 'med';
}

function piStatusClass(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('done')) {
    return 'done';
  }
  if (normalized.includes('risk')) {
    return 'at-risk';
  }
  if (normalized.includes('progress')) {
    return 'progress';
  }
  return 'planned';
}

function buildStructuredRows(entry) {
  const rows = parseCsv(entry.rawText);
  if (entry.sourceType === 'risk_export') {
    return rows.map((row) => ({
      id: row.risk_id,
      title: row.title,
      severity: severityClass(row.severity),
      status: String(row.status || '').toLowerCase(),
      owner: row.owner,
      changed: `${row.last_changed}T12:00:00.000Z`,
      description: row.summary,
      mitigation: row.mitigation,
      relatedEvents: [
        row.opened_date ? `Opened ${row.opened_date}` : '',
        row.next_decision_date ? `Next decision ${row.next_decision_date}` : '',
      ].filter(Boolean),
    }));
  }
  if (entry.sourceType === 'blocker_export') {
    return rows.map((row) => ({
      id: row.blocker_id,
      title: row.title,
      severity: String(row.status || '').toLowerCase() === 'active' ? 'high' : 'med',
      status: String(row.status || '').toLowerCase(),
      owner: row.owner,
      changed: `${row.last_changed}T12:00:00.000Z`,
      description: row.impact,
      mitigation: row.unblock_plan,
      relatedEvents: [
        row.opened_date ? `Opened ${row.opened_date}` : '',
        row.related_risk ? `Linked risk ${row.related_risk}` : '',
      ].filter(Boolean),
    }));
  }
  if (entry.sourceType === 'pi_objectives_export') {
    return rows.map((row) => ({
      id: row.objective_id,
      title: row.objective,
      status: piStatusClass(row.status),
      progressPct: Number.parseInt(row.percent_complete || '0', 10),
    }));
  }
  if (entry.sourceType === 'action_item_export') {
    const keys = Object.keys(rows[0] || {});
    const idKey = keys.find((key) => key.toLowerCase().includes('action')) || keys[0];
    const titleKey = keys.find((key) => key.toLowerCase().includes('title') || key.toLowerCase().includes('action_text')) || keys[1];
    return rows.map((row, index) => ({
      id: row[idKey] || `ACT-${index + 1}`,
      title: row[titleKey] || 'Action item',
      status: String(row.status || 'open').toLowerCase(),
      owner: row.owner || row.assigned_to || 'Unassigned',
      changed: `${row.due_date || entry.documentDate}T12:00:00.000Z`,
      description: row.notes || row.description || row[titleKey] || 'Action item',
      mitigation: row.status || 'Open',
      relatedEvents: [],
    }));
  }
  if (entry.sourceType === 'ado_export') {
    return rows;
  }
  return [];
}

async function extractRawText(filePath, format, manifestRow, metadata) {
  if (textLikeFormats.has(format)) {
    return fs.readFile(filePath, 'utf8');
  }
  if (format === 'docx') {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value || '';
    } catch {
      return `${manifestRow.title}\n\n${metadata.demo_effect || manifestRow.demo_effect || ''}`.trim();
    }
  }
  if (binaryFallbackFormats.has(format)) {
    return `${manifestRow.title}\n\n${metadata.demo_effect || manifestRow.demo_effect || ''}`.trim();
  }
  return `${manifestRow.title}\n\n${metadata.demo_effect || manifestRow.demo_effect || ''}`.trim();
}

function buildPreviewText(entry) {
  if (entry.sourceType === 'weekly_update') {
    return entry.weekly.summary || entry.metadata.demo_effect || entry.demoEffect;
  }
  if (entry.sourceType === 'email') {
    return entry.email.previewLine || entry.metadata.demo_effect || entry.demoEffect;
  }
  if (entry.sourceType === 'transcript') {
    return entry.transcript.meetingSummary || entry.metadata.demo_effect || entry.demoEffect;
  }
  if (entry.sourceType.endsWith('_export')) {
    const rowCount = entry.structuredRows.length;
    return `${rowCount} structured rows imported. ${entry.metadata.demo_effect || entry.demoEffect || ''}`.trim();
  }
  return extractFirstMeaningfulLine(entry.strippedText) || entry.metadata.demo_effect || entry.demoEffect || entry.title;
}

function buildMetaText(entry) {
  const parts = [entry.waveLabel];
  if (entry.uiType === 'transcript' && entry.transcript.attendees.length) {
    parts.push(`${entry.transcript.attendees.length} attendees`);
  }
  if (entry.uiType === 'email') {
    parts.push('Email thread');
  }
  if (entry.uiType === 'weekly') {
    parts.push(entry.author);
  }
  if (entry.uiType === 'ado') {
    parts.push('Delivery export');
  }
  return parts.filter(Boolean).join(' · ');
}

function buildIsoDate(entry) {
  if (entry.email.sentAt && !Number.isNaN(entry.email.sentAt.getTime())) {
    return entry.email.sentAt.toISOString();
  }
  return `${entry.documentDate}T12:00:00.000Z`;
}

function buildTimeLabel(entry) {
  if (entry.email.timeLabel) {
    return entry.email.timeLabel;
  }
  if (entry.transcript.timeLabel) {
    return entry.transcript.timeLabel;
  }
  return entry.waveLabel;
}

function buildTimelineGroups(entries) {
  const grouped = new Map();
  for (const entry of [...entries].sort((left, right) => new Date(right.isoDate) - new Date(left.isoDate))) {
    const key = new Date(entry.isoDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const current = grouped.get(key) ?? [];
    current.push({
      id: `evt-${entry.id}`,
      type: sourceTypeToTimelineType(entry.sourceType),
      timeLabel: buildTimeLabel(entry),
      title: entry.title,
      detail: entry.previewText,
      sourceRef: { sourceId: entry.id, label: entry.title },
    });
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([dateLabel, timelineEntries]) => ({ dateLabel, entries: timelineEntries }));
}

function latestEntryByType(entries, sourceType) {
  return [...entries]
    .filter((entry) => entry.sourceType === sourceType)
    .sort((left, right) => new Date(right.isoDate) - new Date(left.isoDate))[0] ?? null;
}

function buildCoverageAndHealth(entries, productId, stakeholders, latestStatus, latestWeekly, latestCorpusDate) {
  const latestDate = [...entries].sort((left, right) => new Date(right.isoDate) - new Date(left.isoDate))[0]?.isoDate;
  const maxDate = new Date(latestCorpusDate);
  const currentDate = latestDate ? new Date(latestDate) : maxDate;
  const dayDiff = Math.max(0, Math.round((maxDate.getTime() - currentDate.getTime()) / 86400000));

  const hasWeekly = entries.some((entry) => entry.sourceType === 'weekly_update');
  const hasTranscript = entries.some((entry) => entry.sourceType === 'transcript');
  const hasEmail = entries.some((entry) => entry.sourceType === 'email');
  const hasStructured = entries.some((entry) => ['risk_export', 'blocker_export', 'pi_objectives_export'].includes(entry.sourceType));
  const hasAdo = entries.some((entry) => entry.sourceType === 'ado_export');
  const hasIdentityDoc = entries.some((entry) => ['stakeholder_roster', 'product_charter', 'product_brief', 'handoff_memo'].includes(entry.sourceType));

  const coverageScore = Math.round(([hasWeekly, hasTranscript, hasEmail, hasStructured, hasAdo, hasIdentityDoc].filter(Boolean).length / 6) * 100);
  const freshnessScore = Math.max(35, 100 - dayDiff * 12);
  const continuityScore = Math.min(100, Math.round((Math.min(stakeholders.length, 5) / 5) * 40 + Math.min(entries.filter((entry) => entry.sourceType === 'transcript').length, 4) * 10 + Math.min(entries.filter((entry) => entry.sourceType === 'email').length, 5) * 6 + (hasIdentityDoc ? 20 : 0)));
  const syncScore = Math.min(100, Math.round((hasStructured ? 45 : 0) + (hasAdo ? 35 : 0) + (hasWeekly ? 20 : 0)));
  const statusBase = latestStatus === 'healthy' ? 90 : latestStatus === 'risk' ? 46 : 72;
  const overall = Math.round((coverageScore + freshnessScore + continuityScore + syncScore + statusBase) / 5);

  const coverageStrip = [
    { id: `${productId}-weekly`, status: hasWeekly ? 'ok' : 'miss', text: hasWeekly ? 'Weekly updates present' : 'Weekly updates missing' },
    { id: `${productId}-transcripts`, status: entries.filter((entry) => entry.sourceType === 'transcript').length >= 2 ? 'ok' : hasTranscript ? 'warn' : 'miss', text: entries.filter((entry) => entry.sourceType === 'transcript').length >= 2 ? 'Transcript coverage strong' : hasTranscript ? 'Transcript coverage partial' : 'No transcripts' },
    { id: `${productId}-emails`, status: hasEmail ? 'ok' : 'warn', text: hasEmail ? 'Communication artifacts present' : 'Email continuity limited' },
    { id: `${productId}-structured`, status: hasStructured ? 'ok' : 'miss', text: hasStructured ? 'Structured exports current' : 'Structured exports missing' },
    { id: `${productId}-ado`, status: hasAdo ? 'ok' : 'warn', text: hasAdo ? 'ADO data available' : 'ADO sync absent' },
  ];

  const okItems = coverageStrip.filter((item) => item.status === 'ok').map((item, index) => ({ id: `${productId}-ok-${index}`, text: item.text }));
  const highlights = coverageStrip.filter((item) => item.status !== 'ok').map((item, index) => ({ id: `${productId}-gap-${index}`, level: item.status === 'miss' ? 'miss' : 'warn', text: item.text }));
  if (latestWeekly?.weekly?.dataQualityNote && latestWeekly.weekly.dataQualityNote.toLowerCase().includes('weak')) {
    highlights.unshift({ id: `${productId}-gap-quality`, level: 'warn', text: latestWeekly.weekly.dataQualityNote });
  }

  const biggestGap = highlights[0]?.text || (latestWeekly?.weekly?.dataQualityNote ?? null);
  return {
    overall,
    coverage: coverageScore,
    freshness: freshnessScore,
    continuity: continuityScore,
    sync: syncScore,
    coverageStrip,
    okItems,
    highlights,
    biggestGap,
  };
}

function buildAskSuggestions(productData, stakeholders) {
  const suggestions = [];
  if (productData.decisions.length) {
    suggestions.push('What decisions were made recently?');
  }
  if (productData.data.risks.length || productData.data.blockers.length) {
    suggestions.push('Summarize open risks and blockers');
  }
  if (stakeholders.length) {
    suggestions.push('Who are the stakeholders?');
  }
  suggestions.push('What changed most recently?');
  return suggestions.slice(0, 4);
}

function buildNarrative(productName, latestWeekly, latestStatus, latestHighlights) {
  const summary = latestWeekly?.weekly?.summary || latestHighlights[0]?.text || `${productName} evidence has been imported from the prototype corpus.`;
  const statusPhrase = latestStatus === 'healthy' ? 'on track' : latestStatus === 'risk' ? 'at risk' : 'in managed caution';
  return `${escapeHtml(productName)} is <strong>${escapeHtml(statusPhrase)}</strong>. ${escapeHtml(summary)}`;
}

function buildRecentSignals(entries) {
  return [...entries]
    .sort((left, right) => new Date(right.isoDate) - new Date(left.isoDate))
    .slice(0, 4)
    .map((entry, index) => ({
      id: `sig-${entry.id}-${index}`,
      dateLabel: new Date(entry.isoDate).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      type: sourceTypeToTimelineType(entry.sourceType),
      title: entry.title,
    }));
}

function sortProducts(products) {
  const rank = { risk: 0, caution: 1, healthy: 2 };
  return [...products].sort((left, right) => {
    const statusDiff = rank[left.status] - rank[right.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }
    return right.health.overall - left.health.overall;
  });
}

function buildEntryFromSource({
  id,
  ingestOrder,
  productId,
  productName,
  relativePath,
  format,
  sourceType,
  documentDate,
  author,
  title,
  wave,
  waveLabel,
  demoEffect,
  containsDecisions,
  containsActionItems,
  statusSignal,
  metadata = {},
  rawText = '',
}) {
  const frontMatter = parseFrontMatter(rawText);
  const strippedText = stripFrontMatter(rawText);
  const weekly = sourceType === 'weekly_update'
    ? parseWeeklyContent(strippedText)
    : { summary: '', accomplishments: '', risks: '', nextSteps: '', dataQualityNote: '', weekEnding: null };
  const transcript = sourceType === 'transcript'
    ? parseTranscriptContent(strippedText)
    : { attendees: [], decisions: [], actionItems: [], meetingSummary: '', timeLabel: '' };
  const email = sourceType === 'email'
    ? parseEmailContent(rawText)
    : { headers: {}, body: '', previewLine: '', participants: [], sentAt: null, timeLabel: '' };
  const structuredRows = sourceType.endsWith('_export')
    ? buildStructuredRows({ sourceType, rawText, documentDate })
    : [];

  const entry = {
    id,
    ingestOrder: Number.isFinite(Number(ingestOrder)) ? Number(ingestOrder) : null,
    productId,
    productName,
    relativePath,
    format,
    sourceType,
    uiType: sourceTypeToUiType(sourceType),
    documentDate,
    author,
    title,
    wave,
    waveLabel,
    demoEffect,
    containsDecisions,
    containsActionItems,
    statusSignal: mapStatusSignal(statusSignal),
    metadata,
    rawText,
    strippedText,
    weekly,
    transcript,
    email,
    structuredRows,
    frontMatter,
  };

  entry.isoDate = buildIsoDate(entry);
  entry.previewText = buildPreviewText(entry);
  entry.metaText = buildMetaText(entry);
  entry.participants = entry.sourceType === 'transcript'
    ? entry.transcript.attendees
    : entry.sourceType === 'email'
      ? entry.email.participants
      : [];

  return entry;
}

export function deriveCorpusProductState({ productId, productEntries, latestCorpusDate }) {
  const sortedEntries = [...productEntries].sort((left, right) => new Date(right.isoDate) - new Date(left.isoDate));
  const latestEntry = sortedEntries[0];
  if (!latestEntry) {
    return null;
  }

  const productName = latestEntry.productName;
  const latestWeeklyEntry = latestEntryByType(sortedEntries, 'weekly_update');
  const stakeholderSource = latestEntryByType(sortedEntries, 'stakeholder_roster');
  const stakeholders = stakeholderSource ? extractStakeholders(stakeholderSource.strippedText) : [];
  const latestStatus = latestEntry.statusSignal;

  const latestRiskEntry = latestEntryByType(sortedEntries, 'risk_export');
  const latestBlockerEntry = latestEntryByType(sortedEntries, 'blocker_export');
  const latestPiEntry = latestEntryByType(sortedEntries, 'pi_objectives_export');
  const latestActionItemEntry = latestEntryByType(sortedEntries, 'action_item_export');

  const data = {
    risks: latestRiskEntry?.structuredRows ?? [],
    blockers: latestBlockerEntry?.structuredRows ?? [],
    pi: latestPiEntry?.structuredRows ?? [],
    actionItems: latestActionItemEntry?.structuredRows ?? [],
  };

  const decisions = sortedEntries
    .flatMap((entry) => {
      if (entry.sourceType === 'transcript' && entry.transcript.decisions.length) {
        return entry.transcript.decisions;
      }
      if (entry.sourceType === 'email' && entry.containsDecisions) {
        return [entry.previewText];
      }
      if (['decision_memo', 'decision_log', 'release_plan', 'roadmap'].includes(entry.sourceType)) {
        return [entry.previewText];
      }
      return [];
    })
    .filter(Boolean);

  const sources = sortedEntries.map((entry) => ({
    id: entry.id,
    type: entry.uiType,
    title: entry.title,
    date: entry.documentDate,
    meta: entry.metaText,
    previewText: entry.previewText,
    author: entry.author,
    participants: entry.participants,
    contentType: entry.format,
    openable: true,
  }));
  const sourceContents = Object.fromEntries(sortedEntries.map((entry) => [entry.id, entry.strippedText || entry.rawText || entry.previewText]));
  const weeklyUpdates = sortedEntries
    .filter((entry) => entry.sourceType === 'weekly_update')
    .map((entry) => ({
      id: `wu-${entry.id}`,
      weekEnding: entry.weekly.weekEnding || entry.documentDate,
      summary: entry.weekly.summary,
      accomplishments: entry.weekly.accomplishments,
      risks: entry.weekly.risks,
      nextSteps: entry.weekly.nextSteps,
      authorSub: entry.author,
    }));

  const coverage = buildCoverageAndHealth(sortedEntries, productId, stakeholders, latestStatus, latestWeeklyEntry, latestCorpusDate);
  const pm = latestWeeklyEntry?.frontMatter.pm || latestWeeklyEntry?.author || latestEntry.author;
  const piMatch = sortedEntries.map((entry) => entry.rawText).join('\n').match(/PI\s*(\d+)/i);
  const sprintMatch = sortedEntries.map((entry) => entry.title).join('\n').match(/Sprint\s*(\d+)/i);
  const recentSignals = buildRecentSignals(sortedEntries);
  const narrativeText = latestWeeklyEntry?.weekly?.summary || latestEntry.previewText;

  return {
    product: {
      id: productId,
      name: productName,
      status: latestStatus,
      statusLabel: labelForStatus(latestStatus),
      health: {
        overall: coverage.overall,
        coverage: coverage.coverage,
        freshness: coverage.freshness,
        continuity: coverage.continuity,
        sync: coverage.sync,
      },
      counts: {
        risks: data.risks.length,
        blockers: data.blockers.length,
      },
      pm,
      line: productName,
      pi: piMatch ? Number.parseInt(piMatch[1], 10) : 4,
      sprint: sprintMatch ? Number.parseInt(sprintMatch[1], 10) : 1,
      stakeholders,
      evidenceVersion: 1,
      lastSync: sortedEntries[0].isoDate,
      highlights: coverage.highlights,
      okItems: coverage.okItems,
      biggestGap: coverage.biggestGap,
      narrativeHtml: buildNarrative(productName, latestWeeklyEntry, latestStatus, coverage.highlights),
      narrativeText,
      askSuggestions: buildAskSuggestions({ data, decisions }, stakeholders),
      recentSignals,
    },
    productData: {
      evidenceVersion: 1,
      lastStructuredImport: null,
      latestEvidenceUpdate: null,
      timelineCoverage: coverage.coverageStrip,
      timelineGroups: buildTimelineGroups(sortedEntries),
      data,
      sources,
      sourceContents,
      weeklyUpdates,
      decisions,
      entries: sortedEntries,
      latestStatusSignal: latestStatus,
      productName,
    },
  };
}

export function buildUploadedCorpusEntry({
  sourceId,
  ingestOrder = null,
  productId,
  productName,
  relativePath = '',
  format,
  sourceType,
  documentDate,
  author,
  title,
  wave,
  waveLabel,
  demoEffect = '',
  containsDecisions = false,
  containsActionItems = false,
  statusSignal = 'baseline',
  metadata = {},
  rawText = '',
}) {
  return buildEntryFromSource({
    id: sourceId,
    ingestOrder,
    productId,
    productName,
    relativePath,
    format,
    sourceType,
    documentDate,
    author,
    title,
    wave,
    waveLabel,
    demoEffect,
    containsDecisions,
    containsActionItems,
    statusSignal,
    metadata,
    rawText,
  });
}

async function readEntry(manifestRow) {
  const filePath = path.join(corpusRoot, manifestRow.relative_path);
  const metadataPath = `${filePath}.metadata.json`;
  const metadataFile = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const metadata = metadataFile.metadataAttributes || {};
  const rawText = await extractRawText(filePath, manifestRow.format, manifestRow, metadata);
  return buildEntryFromSource({
    id: `src-${manifestRow.ingest_order}`,
    ingestOrder: Number.parseInt(manifestRow.ingest_order, 10),
    productId: manifestRow.product_id,
    productName: manifestRow.product_name,
    relativePath: manifestRow.relative_path,
    format: manifestRow.format,
    sourceType: manifestRow.source_type,
    documentDate: manifestRow.document_date,
    author: manifestRow.author,
    title: manifestRow.title,
    wave: manifestRow.wave,
    waveLabel: manifestRow.wave_label,
    demoEffect: manifestRow.demo_effect,
    containsDecisions: String(manifestRow.contains_decisions).toLowerCase() === 'true',
    containsActionItems: String(manifestRow.contains_action_items).toLowerCase() === 'true',
    statusSignal: manifestRow.status_signal,
    metadata,
    rawText,
  });
}

function buildReportFromCorpus(state, productId) {
  const product = state.products.find((item) => item.id === productId);
  const data = state.productData[productId];
  const latestWeekly = data.weeklyUpdates[0];
  const latestTranscript = data.entries.find((entry) => entry.sourceType === 'transcript');
  const decisionLines = data.decisions.slice(0, 3).map((item) => `- ${item}`).join('\n');
  const accomplishments = latestWeekly?.accomplishments || latestWeekly?.summary || product.narrativeText;
  const riskLine = data.data.risks.slice(0, 2).map((risk) => `${risk.id}: ${risk.title}`).join('; ') || 'No structured risks imported.';
  const blockerLine = data.data.blockers.slice(0, 2).map((blocker) => `${blocker.id}: ${blocker.title}`).join('; ') || 'No structured blockers imported.';
  const coverageItems = [
    { label: 'Risks & Issues', status: data.data.risks.length ? 'ok' : 'miss', count: data.data.risks.length, expected: 1 },
    { label: 'Blockers', status: data.data.blockers.length ? 'ok' : 'warn', count: data.data.blockers.length, expected: 1 },
    { label: 'PI Objectives', status: data.data.pi.length ? 'ok' : 'warn', count: data.data.pi.length, expected: 1 },
    { label: 'Weekly Updates', status: data.weeklyUpdates.length ? 'ok' : 'miss', count: data.weeklyUpdates.length, expected: 1 },
    { label: 'Emails', status: data.sources.filter((item) => item.type === 'email').length ? 'ok' : 'warn', count: data.sources.filter((item) => item.type === 'email').length, expected: 1 },
    { label: 'Transcripts', status: data.sources.filter((item) => item.type === 'transcript').length ? 'ok' : 'warn', count: data.sources.filter((item) => item.type === 'transcript').length, expected: 1 },
  ];
  const coveragePct = Math.round((coverageItems.filter((item) => item.status === 'ok').length / coverageItems.length) * 100);
  const warningText = coverageItems.some((item) => item.status !== 'ok')
    ? 'This report may be incomplete because some evidence categories are still thin.'
    : `Evidence coverage is strong for ${product.name}.`;

  return {
    reportType: 'weekly',
    period: {
      start: data.entries[data.entries.length - 1]?.documentDate || latestWeekly?.weekEnding || state.importedCorpus?.latestCorpusDate?.split('T')[0] || new Date().toISOString().split('T')[0],
      end: data.entries[0]?.documentDate || latestWeekly?.weekEnding || state.importedCorpus?.latestCorpusDate?.split('T')[0] || new Date().toISOString().split('T')[0],
    },
    coverage: {
      percentage: coveragePct,
      items: coverageItems,
      warningText,
    },
    sections: [
      {
        sectionId: 'executive-summary',
        title: 'Executive Summary',
        body: latestWeekly?.summary || product.narrativeText,
      },
      {
        sectionId: 'delivery-highlights',
        title: 'Delivery Highlights',
        body: accomplishments || 'No recent weekly update accomplishments available.',
      },
      {
        sectionId: 'risks-blockers',
        title: 'Risks & Blockers',
        body: `Risks: ${riskLine}. Blockers: ${blockerLine}.`,
      },
      {
        sectionId: 'key-decisions',
        title: 'Key Decisions',
        body: decisionLines || latestTranscript?.previewText || 'No decision artifacts were extracted from the current corpus.',
      },
      {
        sectionId: 'stakeholder-engagement',
        title: 'Stakeholder Engagement',
        body: `${product.stakeholders.join(', ') || 'Stakeholders not explicitly extracted'} appear across ${data.sources.filter((item) => item.type === 'email').length} emails and ${data.sources.filter((item) => item.type === 'transcript').length} transcripts.`,
      },
    ],
    exports: {
      canPdf: true,
      canPptx: true,
      canCopy: true,
      canEmail: true,
    },
  };
}

export async function buildInitialCorpusState(options = {}) {
  const manifestRows = parseCsv(await fs.readFile(manifestPath, 'utf8'));
  const maxWaveIndex = options.maxWave ? waveOrder.indexOf(options.maxWave) : -1;
  const filteredManifestRows = maxWaveIndex >= 0
    ? manifestRows.filter((row) => waveOrder.indexOf(row.wave) <= maxWaveIndex)
    : manifestRows;
  const entries = await Promise.all(filteredManifestRows.map((row) => readEntry(row)));
  const latestCorpusDate = entries.reduce((latest, entry) => latest > entry.isoDate ? latest : entry.isoDate, entries[0]?.isoDate || new Date().toISOString());
  const products = [];
  const groupedEntries = Object.groupBy(entries, (entry) => entry.productId);
  const productData = {};

  for (const [productId, productEntries] of Object.entries(groupedEntries)) {
    const derived = deriveCorpusProductState({ productId, productEntries, latestCorpusDate });
    if (!derived) {
      continue;
    }

    productData[productId] = derived.productData;
    products.push(derived.product);
  }

  const sortedProducts = sortProducts(products);
  const dentalProduct = sortedProducts.find((product) => product.id === 'dental');
  return {
    session: { user: fixedSessionUser },
    rolePresets: fixedRolePresets,
    productRoleScopes: {
      lead: sortedProducts.map((product) => product.id),
      editor: sortedProducts.map((product) => product.id),
      read: ['dental'],
    },
    products: sortedProducts,
    productData,
    reports: dentalProduct ? {
      'rep-seeded': {
        reportId: 'rep-seeded',
        productId: 'dental',
        reportType: 'weekly',
        period: {
          preset: 'current',
          start: '2026-04-09T00:00:00.000Z',
          end: '2026-04-15T23:59:59.000Z',
        },
        evidenceVersion: Number(dentalProduct.evidenceVersion || 1),
        generatedAt: '2026-04-15T10:00:00.000Z',
        coverage: {
          percentage: 78,
          items: [
            { label: 'Sources ingested', status: 'ok', count: 5, expected: 5 },
            { label: 'Evidence freshness', status: 'warn', count: 3, expected: 5 },
          ],
          warningText: 'Coverage is adequate, but a newer artifact may improve confidence.',
        },
        sections: [
          {
            sectionId: 'executive-summary',
            title: 'Executive Summary',
            body: 'Dental remains at risk because the vendor contract and test-environment timeline continue to threaten Sprint 3 execution.',
            bodyCurrent: 'Dental remains at risk because the vendor contract and test-environment timeline continue to threaten Sprint 3 execution.',
            revision: 1,
            editedAt: null,
          },
        ],
      },
    } : {},
    jobs: {},
    connectorProfiles: {
      'mailbox-dental': {
        connectorProfileId: 'mailbox-dental',
        connectorType: 'mailbox',
        productId: 'dental',
        enabled: true,
        config: {
          mailboxAddress: 'dental-program@example.mil',
          pollMinutes: 15,
        },
        lastCursor: null,
        watermark: null,
        lastRunAt: null,
        consecutiveFailures: 0,
      },
      'ado-rest-dental': {
        connectorProfileId: 'ado-rest-dental',
        connectorType: 'ado-rest',
        productId: 'dental',
        enabled: true,
        config: {
          project: 'Dental',
          team: 'Delivery',
        },
        lastCursor: null,
        watermark: null,
        lastRunAt: null,
        consecutiveFailures: 0,
      },
      'ado-mcp-dental': {
        connectorProfileId: 'ado-mcp-dental',
        connectorType: 'ado-mcp',
        productId: 'dental',
        enabled: false,
        config: {
          endpoint: 'local-mcp',
        },
        lastCursor: null,
        watermark: null,
        lastRunAt: null,
        consecutiveFailures: 0,
      },
    },
    syncRuns: [],
    telemetryEvents: [],
    auditEvents: [],
    nextIds: {
      source: 2000,
      job: 900,
      report: 600,
      weekly: 800,
      syncRun: 300,
    },
    importedCorpus: {
      artifactCount: entries.length,
      productCount: sortedProducts.length,
      latestCorpusDate,
      seedWave: options.maxWave || null,
    },
  };
}

export function buildCorpusReport(state, productId) {
  return buildReportFromCorpus(state, productId);
}

export function buildCorpusDocuments(state) {
  return Object.values(state.productData).flatMap((product) => product.entries.map((entry) => ({
    chunkId: `${entry.id}-chunk-1`,
    docId: entry.id,
    text: `${entry.title}\n\n${entry.strippedText || entry.previewText || entry.demoEffect || ''}`.trim(),
    metadata: {
      application: 'AskEIDS',
      environment: process.env.NODE_ENV ?? 'development',
      productId: entry.productId,
      sourceId: entry.id,
      sourceType: entry.uiType,
      title: entry.title,
      sourceDate: entry.isoDate,
      participants: entry.participants,
      author: entry.author,
      wave: entry.wave,
      sourceSubtype: entry.sourceType,
    },
  })));
}
