function uniqueBySourceId(items) {
  const seen = new Set();
  return items.filter((item) => {
    const sourceId = item?.metadata?.sourceId || item?.sourceId || item?.docId;
    if (!sourceId || seen.has(sourceId)) {
      return false;
    }
    seen.add(sourceId);
    return true;
  });
}

export function buildEvidencePack({
  plan,
  product,
  structuredItems = [],
  unstructuredItems = [],
  structuredFailed = false,
} = {}) {
  const dedupedUnstructured = uniqueBySourceId(unstructuredItems).slice(0, plan.maxSources || 8);
  const sourceIds = dedupedUnstructured.map((item) => item.metadata?.sourceId || item.docId).filter(Boolean);
  const sourceTypes = dedupedUnstructured.map((item) => item.metadata?.sourceType).filter(Boolean);

  const warnings = [];
  if (structuredFailed) {
    warnings.push('Structured retrieval degraded. Response used unstructured evidence only.');
  }
  for (const gap of product.highlights || []) {
    if (gap.level !== 'ok') {
      warnings.push(gap.text);
    }
  }

  const hasPreferredType = !plan.preferredSourceTypes?.length
    || sourceTypes.some((sourceType) => plan.preferredSourceTypes.includes(sourceType));

  const hasEnoughSources = sourceIds.length >= (plan.minSourcesForComplete ?? 2);
  const insufficientEvidence = sourceIds.length === 0 && structuredItems.length === 0;

  let status = 'complete';
  if (insufficientEvidence) {
    status = 'insufficientEvidence';
  } else if (!hasEnoughSources || !hasPreferredType || warnings.length > 0) {
    status = 'partial';
  }

  return {
    productId: product.id,
    questionIntent: plan.intent,
    structured: structuredItems,
    unstructured: dedupedUnstructured,
    sourceIds,
    coverage: {
      isPartial: status === 'partial',
      warnings: [...new Set(warnings)],
    },
    status,
  };
}
