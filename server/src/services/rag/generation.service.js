import { generateBedrockText } from '../../lib/aws/bedrockText.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sourceTitle(item) {
  return item?.metadata?.title || item?.docId || item?.sourceId || 'Evidence source';
}

function sourceId(item) {
  return item?.metadata?.sourceId || item?.docId || item?.sourceId;
}

function snippet(item) {
  return String(item?.text || item?.detail || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function deterministicDraft({ question, evidencePack }) {
  const first = evidencePack.unstructured[0] || evidencePack.structured[0];
  const fallbackText = first ? snippet(first) : 'No reliable evidence was available.';
  const citedSources = evidencePack.unstructured.map(sourceId).filter(Boolean);
  const answerHtml = first
    ? `<strong>Evidence-backed response:</strong> ${escapeHtml(fallbackText)}`
    : '<strong>Insufficient evidence</strong>';

  return {
    status: evidencePack.status,
    answerHtml,
    sourceIds: citedSources,
    confidenceLabel: first ? (evidencePack.status === 'complete' ? 'high' : 'medium') : 'low',
    warnings: evidencePack.coverage?.warnings || [],
  };
}

async function maybeRewriteWithBedrock({ question, productName, draft, evidencePack }) {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') {
    return draft.answerHtml;
  }

  const sourceSummary = evidencePack.unstructured
    .map((item) => `- ${sourceTitle(item)}: ${snippet(item)}`)
    .join('\n');

  const rewritten = await generateBedrockText({
    systemPrompt: 'You are drafting an evidence-backed internal status answer. Use only provided evidence. Return concise HTML only.',
    promptText: [
      `Product: ${productName}`,
      `Question: ${question}`,
      'Draft answer:',
      draft.answerHtml,
      'Evidence summary:',
      sourceSummary || '- None',
      'Rewrite the draft in concise HTML, preserving only supported claims.',
    ].join('\n\n'),
    maxTokens: 550,
    temperature: 0.1,
  });

  return rewritten || draft.answerHtml;
}

export async function generateAskAnswer({
  question,
  productName,
  evidencePack,
  testCase = '',
} = {}) {
  const draft = deterministicDraft({ question, evidencePack });
  if (testCase === 'invalidCitations') {
    return {
      ...draft,
      sourceIds: ['unknown-source-id'],
    };
  }

  const rewrittenHtml = await maybeRewriteWithBedrock({
    question,
    productName,
    draft,
    evidencePack,
  });

  return {
    ...draft,
    answerHtml: rewrittenHtml,
  };
}
