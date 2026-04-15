function buildAdoItems(testCase = '') {
  const baseline = [
    {
      kind: 'risk',
      id: 'R-ADO-22',
      title: 'External test environment dependency',
      severity: 'high',
      status: 'open',
      owner: 'Lowry',
      description: 'Vendor timeline remains the primary schedule risk.',
      mitigation: 'Weekly escalation and fallback plan execution.',
      updatedAt: '2026-04-14T12:00:00.000Z',
    },
    {
      kind: 'blocker',
      id: 'B-ADO-09',
      title: 'Authority to operate decision pending',
      severity: 'high',
      status: 'active',
      owner: 'Jaden',
      description: 'ATO approval dependency is blocking production release readiness.',
      mitigation: 'Review package update and security office check-in.',
      updatedAt: '2026-04-14T12:10:00.000Z',
    },
    {
      kind: 'pi-objective',
      id: 'PI-ADO-04',
      title: 'Integrated FHIR readiness',
      status: 'progress',
      progressPct: 58,
      updatedAt: '2026-04-14T12:20:00.000Z',
    },
  ];

  if (testCase === 'adoUpdate') {
    baseline[0] = {
      ...baseline[0],
      status: 'closed',
      severity: 'low',
      mitigation: 'Vendor delivery completed; monitoring only.',
      updatedAt: '2026-04-15T10:00:00.000Z',
    };
  }
  return baseline;
}

function isAfterWatermark(item, watermark) {
  if (!watermark) {
    return true;
  }
  return new Date(item.updatedAt).getTime() > new Date(watermark).getTime();
}

function upsertById(rows, item) {
  const index = rows.findIndex((row) => row.id === item.id);
  if (index === -1) {
    rows.push(item);
    return { inserted: 1, updated: 0 };
  }
  rows[index] = item;
  return { inserted: 0, updated: 1 };
}

export function buildAdoSyncDelta({
  profile,
  currentData,
  testCase = '',
}) {
  if (testCase === 'adoFailure') {
    throw new Error('Injected ADO REST connector failure');
  }

  const watermark = profile?.watermark || null;
  const changed = buildAdoItems(testCase).filter((item) => isAfterWatermark(item, watermark));
  const nextData = {
    risks: [...(currentData?.risks || [])],
    blockers: [...(currentData?.blockers || [])],
    pi: [...(currentData?.pi || [])],
  };

  let inserted = 0;
  let updated = 0;
  for (const item of changed) {
    if (item.kind === 'risk') {
      const result = upsertById(nextData.risks, {
        id: item.id,
        title: item.title,
        severity: item.severity,
        status: item.status,
        owner: item.owner,
        changed: item.updatedAt,
        description: item.description,
        mitigation: item.mitigation,
        relatedEvents: [`Updated from ADO at ${item.updatedAt}`],
      });
      inserted += result.inserted;
      updated += result.updated;
    }
    if (item.kind === 'blocker') {
      const result = upsertById(nextData.blockers, {
        id: item.id,
        title: item.title,
        severity: item.severity,
        status: item.status,
        owner: item.owner,
        changed: item.updatedAt,
        description: item.description,
        mitigation: item.mitigation,
        relatedEvents: [`Updated from ADO at ${item.updatedAt}`],
      });
      inserted += result.inserted;
      updated += result.updated;
    }
    if (item.kind === 'pi-objective') {
      const result = upsertById(nextData.pi, {
        id: item.id,
        title: item.title,
        status: item.status,
        progressPct: item.progressPct,
      });
      inserted += result.inserted;
      updated += result.updated;
    }
  }

  const maxWatermark = changed.length
    ? [...changed].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt))[0].updatedAt
    : watermark;

  return {
    nextData,
    nextWatermark: maxWatermark,
    metrics: {
      changedItems: changed.length,
      inserted,
      updated,
    },
    summary: {
      title: `ADO sync updated ${changed.length} items`,
      detail: `ADO REST sync processed ${changed.length} changed items (${inserted} inserted, ${updated} updated).`,
      date: maxWatermark || new Date().toISOString(),
    },
  };
}
