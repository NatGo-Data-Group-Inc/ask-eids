export function retrieveStructuredEvidence({ readModel, state, productId, rolePreset = 'lead', plan }) {
  if (plan?.testCase === 'structuredFailure') {
    const error = new Error('Injected structured retrieval failure');
    error.code = 'STRUCTURED_RETRIEVAL_FAILED';
    throw error;
  }

  const product = readModel.getProductOrThrow(state, productId, rolePreset);
  const data = readModel.getProductDataOrThrow(state, productId, rolePreset);

  const evidence = [];

  if (plan?.testCase === 'precedenceConflict') {
    evidence.push({
      sourceId: 'src-risk-export-12',
      sourceType: 'risk_export',
      title: 'Dental Risk Register',
      matchedFieldName: 'mitigation_due_date',
      fieldValue: '2026-04-18',
      matchConfidence: 0.95,
      sourceDate: '2026-04-16T00:00:00.000Z',
    });
  }

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
      sourceType: 'decision_log',
      matchedFieldName: null,
      fieldValue: null,
      matchConfidence: 0.5,
      sourceDate: product.lastSync,
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
      sourceId: risk.sourceId || data.lastStructuredImport?.sourceId || null,
      sourceType: 'risk_export',
      matchedFieldName: risk.fieldName || null,
      fieldValue: risk.fieldValue || null,
      matchConfidence: 0.7,
      sourceDate: risk.changed,
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
      sourceId: blocker.sourceId || data.lastStructuredImport?.sourceId || null,
      sourceType: 'blocker_export',
      matchedFieldName: blocker.fieldName || null,
      fieldValue: blocker.fieldValue || null,
      matchConfidence: 0.7,
      sourceDate: blocker.changed,
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
      sourceId: weekly.sourceId || null,
      sourceType: 'weekly_update',
      matchedFieldName: null,
      fieldValue: null,
      matchConfidence: 0.4,
      sourceDate: weekly.weekEnding,
      displayMeta: {},
    });
  }

  return {
    product,
    data,
    items: evidence,
  };
}
