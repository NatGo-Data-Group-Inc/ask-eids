// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App.jsx';

function buildQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

function renderApp(initialEntry) {
  const client = buildQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function baseProductPayload(overrides = {}) {
  return {
    product: {
      id: 'dental',
      name: 'DENTAL / DENCLASS',
      status: 'risk',
      statusLabel: 'At Risk',
      semanticState: {
        executionMode: 'replay',
        policyMode: 'hybrid',
        freshnessStatus: 'fresh',
        usesLastKnownGood: false,
        message: 'AI extraction completed in replay mode. New evidence is now available across Sources, Ask, and reports.',
        aggregateStatus: 'published',
        aggregateVersion: 3,
        featureMode: 'live-email-trust-hardening',
        aggregateId: 'agg-dental-3',
        reasonCodes: [],
      },
      meta: { pi: 4, sprint: 2, pm: 'Jaden', lastSync: '2026-04-16T12:00:00.000Z' },
    },
    permissions: { canUploadArtifact: true, canUpdateWeekly: false, canEditReport: true, canExportReport: true },
    health: { overall: 82, coverage: 80, freshness: 90, continuity: 78, sync: 92, okItems: [], gapItems: [], biggestGap: null },
    overview: { narrativeHtml: 'Current state', recentSignals: [], askSuggestions: ['Did the vendor confirm the mitigation?'], pendingIngestCount: 0 },
    ...overrides,
  };
}

describe('semantic trust ui', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  it('renders freshness badge and degraded overview banner from product semantic state', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental')) {
        return Response.json(baseProductPayload({
          product: {
            ...baseProductPayload().product,
            semanticState: {
              ...baseProductPayload().product.semanticState,
              freshnessStatus: 'degraded',
              usesLastKnownGood: true,
              message: 'This source was stored, but product understanding was not refreshed. Last known good state remains active.',
              reasonCodes: ['publication_failed'],
            },
          },
        }));
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/products/dental?tab=overview');

    expect(await screen.findByTestId('semantic-freshness-badge')).toHaveTextContent('degraded');
    expect(screen.getByTestId('semantic-degraded-banner')).toHaveTextContent('Last known good state remains active');
  });

  it('renders ask degraded banner when answer uses last-known-good semantic state', async () => {
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental') && (!init || init.method !== 'POST')) {
        return Response.json(baseProductPayload());
      }
      if (url.includes('/api/v1/products/dental/ask')) {
        return Response.json({
          status: 'complete',
          answerHtml: '<strong>Evidence-backed response:</strong> The vendor confirmed the mitigation.',
          evidenceStrength: 'high',
          coverage: { isPartial: false, warnings: [] },
          semanticState: {
            freshnessStatus: 'degraded',
            usesLastKnownGood: true,
            message: 'This answer is using the last published product understanding while newer evidence is still being validated.',
          },
          sources: [{ sourceId: 'src-1', title: 'Dental Vendor Mitigation Confirmed', meta: '2026-04-16 - email' }],
        });
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/products/dental?tab=overview');
    const user = userEvent.setup();
    await user.type(await screen.findByTestId('ask-input'), 'Did the vendor confirm the mitigation?');
    await user.click(screen.getByTestId('ask-submit'));

    expect(await screen.findByTestId('ask-degraded-banner')).toHaveTextContent('last published product understanding');
  });

  it('renders source citation mode and fallback wording in source detail', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental/sources/src-1')) {
        return Response.json({
          source: {
            id: 'src-1',
            title: 'Dental Vendor Mitigation Confirmed',
            sourceDate: '2026-04-16T12:00:00.000Z',
            author: 'Lowry',
            summary: 'Vendor confirmed a phased mitigation.',
            citations: [{ label: 'Lines 1-3', kind: 'line_range', mode: 'fallback' }],
            citationMode: 'fallback',
            executionMode: 'replay',
            extractionStatus: 'completed',
            warnings: [],
            previewText: 'Team, We can proceed with the staged mitigation on April 18.',
            binary: true,
            openUrl: '/api/v1/products/dental/sources/src-1/content',
          },
        });
      }
      if (url.includes('/api/v1/products/dental/sources')) {
        return Response.json({
          counts: { all: 1 },
          items: [{
            id: 'src-1',
            type: 'email',
            title: 'Dental Vendor Mitigation Confirmed',
            date: '2026-04-16',
            meta: 'Uploaded',
            typeLabel: 'email',
            processingStatus: 'completed',
          }],
        });
      }
      if (url.includes('/api/v1/products/dental')) {
        return Response.json(baseProductPayload());
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/products/dental?tab=sources&sourceId=src-1');

    expect(await screen.findByTestId('source-detail-citation-mode')).toHaveTextContent('fallback');
    expect(screen.getByText('Exact coordinates were unavailable for this source. Showing the best available reference.')).toBeVisible();
  });

  it('renders report semantic-state banner alongside report content', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental/reports/rep-1')) {
        return Response.json({
          reportId: 'rep-1',
          reportType: 'weekly',
          period: { start: '2026-04-09T00:00:00.000Z', end: '2026-04-16T00:00:00.000Z' },
          semanticState: {
            freshnessStatus: 'degraded',
            usesLastKnownGood: true,
            message: 'This report reflects the last published product understanding. Regenerate after the current evidence refresh completes.',
          },
          coverage: { percentage: 78, items: [], warningText: 'Coverage warning' },
          sections: [{ sectionId: 'executive-summary', title: 'Executive Summary', body: 'Report body', revision: 1, editedAt: null }],
          requiresRegeneration: false,
          regenerateNotice: null,
        });
      }
      if (url.includes('/api/v1/products/dental')) {
        return Response.json(baseProductPayload());
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/products/dental?tab=reports&reportId=rep-1');

    expect(await screen.findByTestId('report-semantic-state-banner')).toHaveTextContent('last published product understanding');
    expect(screen.getByTestId('report-section-executive-summary')).toBeVisible();
  });
});
