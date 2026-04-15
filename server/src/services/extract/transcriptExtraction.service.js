function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPatternMatches(text, pattern) {
  return [...String(text || '').matchAll(pattern)]
    .map((match) => String(match[1] || '').trim())
    .filter(Boolean);
}

function extractSectionBullets(text, heading) {
  const pattern = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const match = String(text || '').match(pattern);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function extractParticipants(text) {
  const attendeeMatch = String(text || '').match(/Attendees:\s*([^\n]+)/i);
  if (!attendeeMatch?.[1]) {
    return [];
  }
  return attendeeMatch[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractTranscriptEntities({ transcriptText, testCase = '' } = {}) {
  if (testCase === 'extractFailure') {
    const error = new Error('Injected transcript extraction failure.');
    error.code = 'EXTRACTION_FAILED';
    throw error;
  }

  const decisions = unique([
    ...extractPatternMatches(transcriptText, /decision\s*:\s*([^\n.!?]+)/gi),
    ...extractSectionBullets(transcriptText, 'Decisions'),
    ...extractSectionBullets(transcriptText, 'Decisions Captured'),
  ]);

  const actionItems = unique([
    ...extractPatternMatches(transcriptText, /action\s*:\s*([^\n.!?]+)/gi),
    ...extractSectionBullets(transcriptText, 'Action Items'),
  ]);

  const stakeholders = extractParticipants(transcriptText);

  return {
    decisions,
    actionItems,
    stakeholders,
  };
}
