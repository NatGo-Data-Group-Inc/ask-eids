export function createSeedState() {
  return {
    session: {
      user: {
        sub: 'user-123',
        displayName: 'B. Jennings',
        email: 'bjennings@example.mil',
      },
    },
    rolePresets: {
      lead: { role: 'lead', canUploadArtifact: true, canUploadTranscript: true, canUpdateWeekly: true, canEditReport: true, canExportReport: true },
      editor: { role: 'editor', canUploadArtifact: true, canUploadTranscript: true, canUpdateWeekly: true, canEditReport: true, canExportReport: true },
      read: { role: 'read', canUploadArtifact: false, canUploadTranscript: false, canUpdateWeekly: false, canEditReport: false, canExportReport: true },
    },
    products: [
      {
        id: 'dental',
        name: 'DENTAL / DENCLASS',
        status: 'risk',
        statusLabel: 'At Risk',
        health: { overall: 82, coverage: 80, freshness: 90, continuity: 78, sync: 92 },
        counts: { risks: 5, blockers: 2 },
        pm: 'Jaden',
        line: 'Dental Services',
        pi: 4,
        sprint: 2,
        stakeholders: ['Dr. Sohl', 'Juan', 'Lowry'],
        evidenceVersion: 1,
        lastSync: '2026-04-13T14:00:00.000Z',
        highlights: [
          { id: 'gap-1', level: 'warn', text: '2 meetings missing transcripts' },
          { id: 'gap-2', level: 'warn', text: 'Weekly summary stale 5 days' },
          { id: 'gap-3', level: 'miss', text: 'Org box not connected' }
        ],
        okItems: [
          { id: 'ok-1', text: 'Risks & Issues synced today' },
          { id: 'ok-2', text: 'Blockers synced today' },
          { id: 'ok-3', text: 'PI Objectives current' }
        ],
        biggestGap: '2 meetings this sprint have no transcript ingested.',
        narrativeHtml: 'Dental is <strong>at risk</strong> in Sprint 2 of PI 4. The primary driver is the <strong>FHIR migration dependency</strong>. Leadership directed FHIR priority over new feature work on 4/9. <strong>Next decision point: vendor confirmation expected 4/15 from Lowry.</strong>',
        askSuggestions: ['What decisions were made this sprint?', 'Summarize open risks and blockers', 'Who are the stakeholders?', 'What changed since last sprint?'],
        recentSignals: [
          { id: 'sig-1', dateLabel: '4/12', type: 'email', title: 'Jaden -> Dr. Sohl: Updated FHIR test timeline' },
          { id: 'sig-2', dateLabel: '4/11', type: 'weekly', title: 'Sprint 2 weekly update' },
          { id: 'sig-3', dateLabel: '4/10', type: 'risk', title: 'R-014 escalated MED -> HIGH' },
          { id: 'sig-4', dateLabel: '4/09', type: 'decision', title: 'FHIR prioritized over new features' }
        ]
      },
      {
        id: 'optima',
        name: 'OPTIMA',
        status: 'healthy',
        statusLabel: 'On Track',
        health: { overall: 91, coverage: 95, freshness: 88, continuity: 92, sync: 90 },
        counts: { risks: 2, blockers: 0 },
        pm: 'Anna K.',
        line: 'Clinical Systems',
        pi: 4,
        sprint: 2,
        stakeholders: ['Sandy', 'Anna K.'],
        evidenceVersion: 1,
        lastSync: '2026-04-15T11:00:00.000Z',
        highlights: [{ id: 'ok-1', level: 'ok', text: 'All sources current' }],
        okItems: [{ id: 'ok-1', text: 'All sources current' }],
        biggestGap: null,
        narrativeHtml: 'Optima is <strong>on track</strong> in Sprint 2. Documentation is thorough and no open blockers remain.',
        askSuggestions: ['Summarize current state'],
        recentSignals: [{ id: 'sig-1', dateLabel: '4/15', type: 'weekly', title: 'Weekly update published' }]
      },
      {
        id: 'essence',
        name: 'ESSENCE',
        status: 'caution',
        statusLabel: 'Caution',
        health: { overall: 44, coverage: 40, freshness: 35, continuity: 50, sync: 52 },
        counts: { risks: 1, blockers: 1 },
        pm: 'Jones Team',
        line: 'Surveillance',
        pi: 4,
        sprint: 1,
        stakeholders: ['Cmd. Jones'],
        evidenceVersion: 1,
        lastSync: '2026-04-12T09:00:00.000Z',
        highlights: [{ id: 'gap-1', level: 'miss', text: 'PM handoff incomplete' }],
        okItems: [],
        biggestGap: 'PM handoff from previous contractor is incomplete.',
        narrativeHtml: 'ESSENCE is at <strong>caution</strong> because the PM handoff left significant knowledge gaps.',
        askSuggestions: ['What are the evidence gaps?'],
        recentSignals: [{ id: 'sig-1', dateLabel: '4/03', type: 'risk', title: 'Continuity risk remains open' }]
      },
      {
        id: 'jomis',
        name: 'JOMIS',
        status: 'caution',
        statusLabel: 'Caution',
        health: { overall: 53, coverage: 55, freshness: 60, continuity: 42, sync: 56 },
        counts: { risks: 3, blockers: 1 },
        pm: 'Unassigned',
        line: 'Joint Operations',
        pi: 4,
        sprint: 2,
        stakeholders: ['Sandy'],
        evidenceVersion: 1,
        lastSync: '2026-04-10T12:00:00.000Z',
        highlights: [{ id: 'gap-1', level: 'warn', text: 'Weekly update stale 18 days' }],
        okItems: [],
        biggestGap: 'PM is currently unassigned. No weekly updates in 18 days.',
        narrativeHtml: 'JOMIS is at <strong>caution</strong> with no assigned PM and stale documentation.',
        askSuggestions: ['What is missing?'],
        recentSignals: [{ id: 'sig-1', dateLabel: '3/28', type: 'risk', title: 'Staff turnover risk identified' }]
      },
      {
        id: 'biobank',
        name: 'DIGITAL BIOBANK',
        status: 'healthy',
        statusLabel: 'On Track',
        health: { overall: 73, coverage: 70, freshness: 80, continuity: 68, sync: 75 },
        counts: { risks: 1, blockers: 0 },
        pm: 'TBD',
        line: 'Research Systems',
        pi: 4,
        sprint: 2,
        stakeholders: [],
        evidenceVersion: 1,
        lastSync: '2026-04-15T08:00:00.000Z',
        highlights: [{ id: 'gap-1', level: 'warn', text: '1 transcript missing' }],
        okItems: [{ id: 'ok-1', text: 'Weekly update current' }],
        biggestGap: null,
        narrativeHtml: 'Digital Biobank is <strong>on track</strong> with minor gaps.',
        askSuggestions: ['Summarize project health'],
        recentSignals: [{ id: 'sig-1', dateLabel: '4/14', type: 'document', title: 'Biobank architecture note uploaded' }]
      },
      {
        id: 'mhsgen',
        name: 'MHS GENESIS INT.',
        status: 'healthy',
        statusLabel: 'On Track',
        health: { overall: 85, coverage: 88, freshness: 82, continuity: 84, sync: 86 },
        counts: { risks: 0, blockers: 0 },
        pm: 'Lt. Martinez',
        line: 'Health Records',
        pi: 4,
        sprint: 2,
        stakeholders: [],
        evidenceVersion: 1,
        lastSync: '2026-04-15T13:30:00.000Z',
        highlights: [{ id: 'ok-1', level: 'ok', text: 'All sources current' }],
        okItems: [{ id: 'ok-1', text: 'All sources current' }],
        biggestGap: null,
        narrativeHtml: 'MHS Genesis Integration is <strong>on track</strong>. All knowledge sources are current.',
        askSuggestions: ['What is current health?'],
        recentSignals: [{ id: 'sig-1', dateLabel: '4/15', type: 'weekly', title: 'Daily sync completed' }]
      }
    ],
    productData: {
      dental: {
        evidenceVersion: 1,
        lastStructuredImport: null,
        latestEvidenceUpdate: null,
        timelineCoverage: [
          { id: 'c1', status: 'ok', text: 'Risks synced' },
          { id: 'c2', status: 'ok', text: 'Blockers synced' },
          { id: 'c3', status: 'ok', text: 'PI Obj current' },
          { id: 'c4', status: 'warn', text: '2 transcripts missing' },
          { id: 'c5', status: 'miss', text: 'No org box' }
        ],
        timelineGroups: [
          { dateLabel: 'April 13', entries: [{ id: 'evt-1', type: 'decision', timeLabel: '2:30 PM', title: 'MVP scoped to single-product pilot (Dental)', detail: 'Innovation cell agreed to use risks, blockers, PI objectives, and weekly summaries for the pilot.', sourceRef: { sourceId: 'src-301', label: 'Meeting Transcript 4/13' } }] },
          { dateLabel: 'April 12', entries: [{ id: 'evt-2', type: 'email', timeLabel: '2:14 PM', title: 'Jaden -> Dr. Sohl: Updated FHIR test timeline', detail: 'Revised schedule attached and vendor confirmation expected by 4/15.', sourceRef: { sourceId: 'src-201', label: 'Email thread' } }] },
          { dateLabel: 'April 11', entries: [{ id: 'evt-3', type: 'weekly', timeLabel: '4:00 PM', title: 'Sprint 2 weekly update', detail: 'Vendor delay remains the primary concern.', sourceRef: { sourceId: 'src-401', label: 'PM Hub Weekly Summary' } }] },
          { dateLabel: 'April 10', entries: [{ id: 'evt-4', type: 'risk', timeLabel: '9:30 AM', title: 'R-014 escalated: FHIR migration dependency', detail: 'Vendor confirmed a 2-week slip on the test environment delivery.', sourceRef: { sourceId: 'src-501', label: 'Risk Log R-014' } }] },
          { dateLabel: 'April 9', entries: [{ id: 'evt-5', type: 'transcript', timeLabel: '3:00 PM', title: 'Sprint 2 Review', detail: 'Leadership directed FHIR priority over new feature work. Lowry to confirm vendor timeline by 4/15.', sourceRef: { sourceId: 'src-301', label: 'Sprint 2 Review Transcript' } }] }
        ],
        data: {
          risks: [
            { id: 'R-014', title: 'FHIR migration dependency', severity: 'high', status: 'open', owner: 'Lowry', changed: '2026-04-10T09:30:00.000Z', description: 'Vendor confirmed a 2-week slip on test environment delivery.', mitigation: 'Lowry to confirm revised timeline by 4/15.', relatedEvents: ['2026-04-10 Escalated MED -> HIGH', '2026-04-09 Discussed in Sprint 2 Review'] },
            { id: 'R-016', title: 'Test coverage gap', severity: 'high', status: 'open', owner: 'Jaden', changed: '2026-04-09T10:00:00.000Z', description: 'Integration test coverage is below threshold for FHIR endpoints.', mitigation: 'Jaden committed to adding tests by Sprint 3.', relatedEvents: ['2026-04-09 Committed during Sprint Review'] },
            { id: 'R-015', title: 'Vendor delivery timeline', severity: 'med', status: 'open', owner: 'Lowry', changed: '2026-04-08T10:00:00.000Z', description: 'Overall vendor delivery timeline may slip if contract is not signed.', mitigation: 'Escalated to Benjiman for contract review.', relatedEvents: ['2026-04-08 Raised by Lowry'] }
          ],
          blockers: [
            { id: 'B-003', title: 'Vendor contract unsigned', severity: 'high', status: 'active', owner: 'Lowry', changed: '2026-04-08T08:00:00.000Z', description: 'Vendor contract remains unsigned and blocks Sprint 3 planning.', mitigation: 'Escalated to Benjiman.', relatedEvents: ['2026-04-08 Raised', '2026-04-10 Linked to R-014 escalation'] },
            { id: 'B-004', title: 'Test environment access pending', severity: 'med', status: 'active', owner: 'Dev Team B', changed: '2026-04-06T08:00:00.000Z', description: 'Access credentials are not yet provisioned.', mitigation: 'Waiting on vendor contract (B-003).', relatedEvents: ['2026-04-06 Raised by Dev Team B'] }
          ],
          pi: [
            { id: 'PIO-1', title: 'FHIR endpoint mapping complete', status: 'progress', progressPct: 60 },
            { id: 'PIO-2', title: 'Security assessment delivered', status: 'done', progressPct: 100 },
            { id: 'PIO-3', title: 'Test environment ready', status: 'at-risk', progressPct: 30 },
            { id: 'PIO-4', title: 'Stakeholder demo delivered', status: 'planned', progressPct: 0 },
            { id: 'PIO-5', title: 'Data migration plan finalized', status: 'progress', progressPct: 45 }
          ]
        },
        sources: [
          { id: 'src-301', type: 'transcript', title: 'Sprint 2 Review Transcript', date: '2026-04-09', meta: '45 min · 6 attendees · 2 decisions extracted', previewText: 'Leadership directed FHIR priority over new feature work.', author: 'Jaden', participants: ['Dr. Sohl', 'Lowry'], contentType: 'text/plain', openable: true },
          { id: 'src-201', type: 'email', title: 'Jaden -> Dr. Sohl: FHIR test timeline', date: '2026-04-12', meta: 'Thread · 3 messages · 1 attachment', previewText: 'Revised schedule attached. Vendor confirmation expected by 4/15.', author: 'Jaden', participants: ['Dr. Sohl'], contentType: 'message/rfc822', openable: true },
          { id: 'src-202', type: 'email', title: 'Dr. Sohl -> Jaden: Test schedule approval', date: '2026-04-07', meta: 'Thread · 2 messages', previewText: 'Approved the revised test schedule. Please proceed.', author: 'Dr. Sohl', participants: ['Jaden'], contentType: 'message/rfc822', openable: true },
          { id: 'src-401', type: 'weekly', title: 'Sprint 2 Weekly Update', date: '2026-04-11', meta: 'PM Hub · Author: Jaden', previewText: 'Sprint 2 continues with FHIR prep. Vendor delay remains the primary concern.', author: 'Jaden', participants: [], contentType: 'text/markdown', openable: true },
          { id: 'src-701', type: 'ado', title: 'Sprint 2 Board Snapshot', date: '2026-04-04', meta: '12 stories · 40 pts planned', previewText: 'FHIR migration represents 60% of sprint capacity.', author: 'ADO Sync', participants: [], contentType: 'application/json', openable: true }
        ],
        sourceContents: {
          'src-301': 'Sprint 2 Review transcript content. Leadership directed FHIR priority over new feature work. Lowry to confirm vendor timeline by 4/15. Jaden committed to integration tests by Sprint 3.',
          'src-201': 'Email content: revised schedule attached. Expecting vendor confirmation by 4/15.',
          'src-202': 'Email content: Approved the revised test schedule. Please proceed.',
          'src-401': 'Weekly summary content for Sprint 2.',
          'src-701': 'ADO board summary.'
        },
        weeklyUpdates: [
          { id: 'wu-401', weekEnding: '2026-04-13', summary: 'Sprint 2 continues with FHIR prep and vendor delay remains the primary concern.', accomplishments: 'Revised schedule approved and security assessment delivered.', risks: 'Vendor delay remains primary concern.', nextSteps: 'Confirm vendor timeline by 4/15.', authorSub: 'user-123' }
        ]
      }
    },
    reports: {
      'rep-seeded': {
        reportId: 'rep-seeded',
        productId: 'dental',
        reportType: 'weekly',
        period: {
          preset: 'current',
          start: '2026-04-09T00:00:00.000Z',
          end: '2026-04-15T23:59:59.000Z',
        },
        evidenceVersion: 1,
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
    },
    jobs: {},
    telemetryEvents: [],
    auditEvents: [],
    nextIds: { source: 900, job: 900, report: 440, weekly: 500 }
  };
}
