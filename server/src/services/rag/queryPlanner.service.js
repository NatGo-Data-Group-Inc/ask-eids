function intentFromQuestion(question) {
  const normalized = String(question || '').trim().toLowerCase();
  if (normalized.includes('decision')) return 'decision-history';
  if (normalized.includes('risk') || normalized.includes('blocker')) return 'risk-blocker-summary';
  if (normalized.includes('stakeholder')) return 'stakeholder-context';
  if (normalized.includes('change') || normalized.includes('recent') || normalized.includes('update')) return 'recent-changes';
  return 'generic';
}

function preferredSourceTypes(intent) {
  if (intent === 'decision-history') return ['transcript', 'email', 'document'];
  if (intent === 'risk-blocker-summary') return ['weekly', 'ado', 'document', 'transcript', 'email'];
  if (intent === 'stakeholder-context') return ['document', 'email', 'transcript', 'weekly'];
  if (intent === 'recent-changes') return ['weekly', 'email', 'transcript', 'document', 'ado'];
  return [];
}

export function buildRetrievalPlan({ productId, question, testCase = '' } = {}) {
  const intent = intentFromQuestion(question);
  return {
    intent,
    productId,
    question: String(question || '').trim(),
    preferredSourceTypes: preferredSourceTypes(intent),
    topK: 8,
    maxSources: 8,
    minSourcesForComplete: 2,
    testCase,
  };
}
