export function retrieveStructuredEvidence({ readModel, state, productId, rolePreset = 'lead', plan }) {
  if (plan?.testCase === 'structuredFailure') {
    const error = new Error('Injected structured retrieval failure');
    error.code = 'STRUCTURED_RETRIEVAL_FAILED';
    throw error;
  }

  const product = readModel.getProductOrThrow(state, productId, rolePreset);
  const data = readModel.getProductDataOrThrow(state, productId, rolePreset);

  const evidence = [];

  for (const decision of data.decisions.slice(0, 6)) {
    evidence.push({
      kind: 'decision',
      id: `decision-${evidence.length + 1}`,
      title: decision,
      detail: decision,
      status: null,
      severity: null,
      effectiveAt: product.lastSync,
      sourceId: null,
      displayMeta: {},
    });
  }

  for (const risk of data.data.risks.slice(0, 6)) {
    evidence.push({
      kind: 'risk',
      id: risk.id,
      title: risk.title,
      detail: risk.description,
      status: risk.status,
      severity: risk.severity,
      effectiveAt: risk.changed,
      sourceId: null,
      displayMeta: { owner: risk.owner },
    });
  }

  for (const blocker of data.data.blockers.slice(0, 6)) {
    evidence.push({
      kind: 'blocker',
      id: blocker.id,
      title: blocker.title,
      detail: blocker.description,
      status: blocker.status,
      severity: blocker.severity,
      effectiveAt: blocker.changed,
      sourceId: null,
      displayMeta: { owner: blocker.owner },
    });
  }

  for (const weekly of data.weeklyUpdates.slice(0, 3)) {
    evidence.push({
      kind: 'weekly',
      id: weekly.id,
      title: `Weekly update ${weekly.weekEnding}`,
      detail: weekly.summary,
      status: null,
      severity: null,
      effectiveAt: weekly.weekEnding,
      sourceId: null,
      displayMeta: {},
    });
  }

  return {
    product,
    data,
    items: evidence,
  };
}
