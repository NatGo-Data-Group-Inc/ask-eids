import { HttpError } from '../common/httpError.js';
import { getFilterKeyForSourceType, getSourceTypeLabel, isBinarySourceType } from '../../../../shared/artifactTypes.js';

export function createReadModelService({ errorCodes }) {
  function resolveProductScope(state, rolePreset) {
    const defaults = state.products.map((item) => item.id);
    return state.productRoleScopes?.[rolePreset] ?? defaults;
  }

  function inScope(state, rolePreset, productId) {
    return resolveProductScope(state, rolePreset).includes(productId);
  }

  function getPermissions(state, rolePreset) {
    return state.rolePresets[rolePreset] ?? state.rolePresets.read;
  }

  function forbidden(message = 'You don’t have access to this product.') {
    return new HttpError(403, errorCodes.FORBIDDEN, message);
  }

  function notFound(message = 'This product does not exist.') {
    return new HttpError(404, errorCodes.NOT_FOUND, message);
  }

  function getProductOrThrow(state, productId, rolePreset = 'lead') {
    const product = state.products.find((item) => item.id === productId);
    if (!product) {
      throw notFound();
    }
    if (!inScope(state, rolePreset, productId)) {
      throw forbidden();
    }
    return product;
  }

  function getProductDataOrThrow(state, productId, rolePreset = 'lead') {
    const data = state.productData[productId];
    if (!data) {
      throw notFound();
    }
    if (!inScope(state, rolePreset, productId)) {
      throw forbidden();
    }
    return data;
  }

  function portfolioPayload(state, rolePreset = 'lead') {
    const visibleProducts = state.products.filter((product) => inScope(state, rolePreset, product.id));
    const needsAttention = visibleProducts.filter((product) => ['risk', 'caution'].includes(product.status));
    const onTrack = visibleProducts.filter((product) => product.status === 'healthy');
    const overdueWeeklyCount = visibleProducts.filter((product) => product.highlights.some((item) => item.text.toLowerCase().includes('weekly'))).length;
    const belowFiftyCount = visibleProducts.filter((product) => product.health.overall < 50).length;
    const dataGapCount = visibleProducts.filter((product) => product.highlights.length > 0).length;
    const strongEvidenceCount = visibleProducts.filter((product) => product.highlights.length === 0).length;
    const averageHealth = visibleProducts.length
      ? Math.round(visibleProducts.reduce((sum, product) => sum + product.health.overall, 0) / visibleProducts.length)
      : 0;

    return {
      summary: {
        productCount: visibleProducts.length,
        averageHealth,
        overdueWeeklyCount,
        needsAttentionCount: needsAttention.length,
        belowFiftyCount,
      },
      alerts: [
        { id: 'a1', type: 'warning', text: `${belowFiftyCount} products have knowledge health below 50%` },
        { id: 'a2', type: 'warning', text: `${overdueWeeklyCount} weekly updates are overdue` },
        { id: 'a3', type: 'warning', text: `${dataGapCount} products still show evidence gaps while ${strongEvidenceCount} are fully corroborated by the imported corpus` },
      ],
      groups: {
        needsAttention,
        onTrack,
      },
    };
  }

  function quickViewPayload(state, type, rolePreset = 'lead') {
    const scopedProducts = state.products.filter((product) => inScope(state, rolePreset, product.id));
    const scopedProductIds = new Set(scopedProducts.map((item) => item.id));
    const productMap = Object.fromEntries(scopedProducts.map((product) => [product.id, product]));
    const allRisks = Object.entries(state.productData)
      .filter(([productId]) => scopedProductIds.has(productId))
      .flatMap(([productId, data]) => data.data.risks.map((risk) => ({
      productId,
      productName: productMap[productId]?.name ?? productId,
      itemId: risk.id,
      title: risk.title,
      severity: risk.severity,
      status: risk.status,
      lastChangedAt: risk.changed,
    })));
    const allBlockers = Object.entries(state.productData)
      .filter(([productId]) => scopedProductIds.has(productId))
      .flatMap(([productId, data]) => data.data.blockers.map((blocker) => ({
      productId,
      productName: productMap[productId]?.name ?? productId,
      itemId: blocker.id,
      title: blocker.title,
      severity: blocker.severity,
      status: blocker.status,
      lastChangedAt: blocker.changed,
    })));
    if (type === 'risks') {
      return {
        type,
        title: 'All Risks',
        items: allRisks.sort((left, right) => new Date(right.lastChangedAt) - new Date(left.lastChangedAt)),
      };
    }
    if (type === 'blockers') {
      return {
        type,
        title: 'All Blockers',
        items: allBlockers.sort((left, right) => new Date(right.lastChangedAt) - new Date(left.lastChangedAt)),
      };
    }
    if (type === 'gaps') {
      return {
        type,
        title: 'Data Gaps',
        items: scopedProducts.flatMap((product) => product.highlights.filter((gap) => gap.level !== 'ok').map((gap) => ({
          productId: product.id,
          productName: product.name,
          itemId: gap.id,
          title: gap.text,
          severity: gap.level,
          status: 'open',
          lastChangedAt: product.lastSync,
        }))),
      };
    }
    return {
      type,
      title: 'Weekly Brief Prep',
      items: scopedProducts.map((product) => ({
        productId: product.id,
        productName: product.name,
        itemId: `${product.id}-brief`,
        title: product.biggestGap || `${product.statusLabel} - ${product.pm}`,
        severity: product.status,
        status: 'ready',
        lastChangedAt: product.lastSync,
      })),
    };
  }

  function searchPayload(state, query, rolePreset = 'lead') {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      throw new HttpError(400, errorCodes.VALIDATION_ERROR, 'Search query must be at least 2 characters.', { field: 'q' });
    }

    const products = state.products
      .filter((product) => inScope(state, rolePreset, product.id))
      .filter((product) => product.name.toLowerCase().includes(q))
      .map((product) => ({ id: product.id, label: product.name, route: `/products/${product.id}?tab=overview` }));

    const sources = Object.entries(state.productData)
      .filter(([productId]) => inScope(state, rolePreset, productId))
      .flatMap(([productId, data]) => data.sources.map((source) => ({ productId, ...source })))
      .filter((source) => `${source.title} ${source.meta}`.toLowerCase().includes(q))
      .map((source) => ({ id: source.id, label: source.title, route: `/products/${source.productId}?tab=sources&sourceId=${source.id}`, productId: source.productId }));

    return {
      query,
      groups: [
        { type: 'products', items: products },
        { type: 'sources', items: sources },
      ].filter((group) => group.items.length > 0),
    };
  }

  function productPayload(state, productId, rolePreset) {
    const product = getProductOrThrow(state, productId, rolePreset);
    const permissions = getPermissions(state, rolePreset);
    const ingestJobs = Object.values(state.jobs || {})
      .filter((job) => job.jobType === 'ingest' && job.productId === productId)
      .sort((left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0));
    const latestIngestJob = ingestJobs[0] || null;
    const pendingIngestCount = ingestJobs.filter((job) => ['queued', 'running'].includes(job.status)).length;
    const productData = state.productData[productId];
    const latestSource = latestIngestJob?.result?.sourceId
      ? productData?.sources?.find((item) => item.id === latestIngestJob.result.sourceId)
      : null;
    return {
      product: {
        id: product.id,
        name: product.name,
        status: product.status,
        statusLabel: product.statusLabel,
        semanticState: {
          executionMode: product.semanticState?.executionMode || state.semanticConfig?.executionMode || 'replay',
          aggregateStatus: product.semanticState?.aggregateStatus || 'legacy',
          aggregateVersion: Number(product.semanticState?.aggregateVersion || product.evidenceVersion || productData?.evidenceVersion || 1),
          featureMode: product.semanticState?.featureMode || 'legacy',
          aggregateId: product.semanticState?.aggregateId || null,
        },
        meta: {
          pi: product.pi,
          sprint: product.sprint,
          pm: product.pm,
          lastSync: product.lastSync,
        },
      },
      permissions: {
        canUploadArtifact: permissions.canUploadArtifact ?? permissions.canUploadTranscript,
        canUploadTranscript: permissions.canUploadTranscript,
        canUpdateWeekly: permissions.canUpdateWeekly,
        canEditReport: permissions.canEditReport,
        canExportReport: permissions.canExportReport,
      },
      health: {
        overall: product.health.overall,
        coverage: product.health.coverage,
        freshness: product.health.freshness,
        continuity: product.health.continuity,
        sync: product.health.sync,
        okItems: product.okItems,
        gapItems: product.highlights.filter((item) => item.level !== 'ok'),
        biggestGap: product.biggestGap,
      },
      overview: {
        narrativeHtml: product.narrativeHtml,
        recentSignals: product.recentSignals,
        askSuggestions: product.askSuggestions,
        pendingIngestCount,
        latestIngest: latestIngestJob
          ? {
            jobId: latestIngestJob.jobId,
            status: latestIngestJob.status,
            stage: latestIngestJob.stage || latestIngestJob.status,
            sourceId: latestIngestJob.result?.sourceId || null,
            title: latestSource?.title || latestIngestJob.title || latestIngestJob.result?.title || 'Uploaded artifact',
            sourceType: latestSource?.type || latestIngestJob.sourceType || null,
            warningText: latestSource?.warningText || latestIngestJob.message || null,
            updatedDomains: latestIngestJob.result?.updatedDomains || [],
          }
          : null,
        latestEvidenceUpdate: productData?.latestEvidenceUpdate || null,
      },
    };
  }

  function timelinePayload(state, productId, filter = 'all', rolePreset = 'lead') {
    const data = getProductDataOrThrow(state, productId, rolePreset);
    return {
      coverageStrip: data.timelineCoverage,
      groups: data.timelineGroups
        .map((group) => ({ ...group, entries: group.entries.filter((entry) => filter === 'all' || entry.type === filter) }))
        .filter((group) => group.entries.length > 0),
    };
  }

  function dataPayload(state, productId, dataset = 'risks', rolePreset = 'lead') {
    const data = getProductDataOrThrow(state, productId, rolePreset);
    const rows = data.data[dataset];
    return {
      dataset,
      count: rows.length,
      rows,
      importImpact: data.lastStructuredImport?.dataset === dataset ? data.lastStructuredImport : null,
    };
  }

  function sourcesPayload(state, productId, type = 'all', rolePreset = 'lead') {
    const all = getProductDataOrThrow(state, productId, rolePreset).sources;
    const filtered = type === 'all' ? all : all.filter((source) => getFilterKeyForSourceType(source.type) === type || source.type === type);
    const buildCount = (filterKey) => all.filter((source) => getFilterKeyForSourceType(source.type) === filterKey).length;
    return {
      counts: {
        all: all.length,
        transcript: buildCount('transcript'),
        email: buildCount('email'),
        document: buildCount('document'),
        slide_deck: buildCount('slide_deck'),
        spreadsheet: buildCount('spreadsheet'),
        weekly: buildCount('weekly'),
        ado: buildCount('ado'),
      },
      items: filtered.map((source) => ({
        ...source,
        filterKey: getFilterKeyForSourceType(source.type),
        typeLabel: getSourceTypeLabel(source.type),
        processingStatus: source.ingestStatus || 'completed',
      })),
    };
  }

  function sourceDetailPayload(state, productId, sourceId, rolePreset = 'lead') {
    const data = getProductDataOrThrow(state, productId, rolePreset);
    const source = data.sources.find((item) => item.id === sourceId);
    if (!source) {
      throw notFound('Source not found.');
    }
    return {
      source: {
        id: source.id,
        type: source.type,
        title: source.title,
        sourceDate: `${source.date}T12:00:00.000Z`,
        author: source.author,
        participants: source.participants,
        metadata: {
          contentType: source.contentType,
        },
        previewText: source.previewText,
        summary: source.summary || source.previewText || source.title,
        citations: Array.isArray(source.citations) ? source.citations : [],
        confidence: source.confidence || (source.ingestStatus === 'partial' ? 'medium' : source.ingestStatus === 'failed' ? 'low' : 'high'),
        warnings: Array.isArray(source.warnings)
          ? source.warnings
          : source.warningText
            ? [source.warningText]
            : [],
        processingStatus: source.ingestStatus || 'completed',
        warningText: source.warningText || null,
        typeLabel: getSourceTypeLabel(source.type),
        binary: isBinarySourceType(source.type),
        openUrl: `/api/v1/products/${productId}/sources/${sourceId}/content`,
      },
    };
  }

  return {
    resolveProductScope,
    inScope,
    getPermissions,
    forbidden,
    notFound,
    getProductOrThrow,
    getProductDataOrThrow,
    portfolioPayload,
    quickViewPayload,
    searchPayload,
    productPayload,
    timelinePayload,
    dataPayload,
    sourcesPayload,
    sourceDetailPayload,
  };
}
