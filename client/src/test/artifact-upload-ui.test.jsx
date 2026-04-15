// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

function renderApp(initialEntry = '/products/dental?tab=overview') {
  const client = buildQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('artifact upload UI integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  });

  it('shows upload artifact entry for editors and hides it for read-only users', async () => {
    const fetchMock = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental')) {
        return Response.json({
          product: { id: 'dental', name: 'DENTAL / DENCLASS', status: 'risk', statusLabel: 'At Risk', meta: { pi: 4, sprint: 2, pm: 'Jaden', lastSync: '2026-04-15T12:00:00.000Z' } },
          permissions: { canUploadArtifact: !url.includes('asRole=read'), canUpdateWeekly: false, canEditReport: true, canExportReport: true },
          health: { overall: 82, coverage: 80, freshness: 90, continuity: 78, sync: 92, okItems: [], gapItems: [], biggestGap: null },
          overview: { narrativeHtml: 'Current state', recentSignals: [], askSuggestions: [], pendingIngestCount: 0 },
        });
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstRender = renderApp('/products/dental?tab=overview');
    expect(await screen.findByTestId('upload-artifact-button')).toBeVisible();
    firstRender.unmount();

    renderApp('/products/dental?tab=overview&asRole=read');
    await waitFor(() => {
      expect(screen.queryByTestId('upload-artifact-button')).not.toBeInTheDocument();
    });
  });

  it('keeps modal open and preserves values when upload fails retryably', async () => {
    const productPayload = {
      product: { id: 'dental', name: 'DENTAL / DENCLASS', status: 'risk', statusLabel: 'At Risk', meta: { pi: 4, sprint: 2, pm: 'Jaden', lastSync: '2026-04-15T12:00:00.000Z' } },
      permissions: { canUploadArtifact: true, canUpdateWeekly: false, canEditReport: true, canExportReport: true },
      health: { overall: 82, coverage: 80, freshness: 90, continuity: 78, sync: 92, okItems: [], gapItems: [], biggestGap: null },
      overview: { narrativeHtml: 'Current state', recentSignals: [], askSuggestions: [], pendingIngestCount: 0 },
    };
    const fetchMock = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/v1/session')) {
        return Response.json({ user: { displayName: 'B. Jennings' } });
      }
      if (url.includes('/api/v1/products/dental/sources?')) {
        return Response.json({ counts: { all: 0 }, items: [] });
      }
      if (url.includes('/api/v1/products/dental') && (!init || init.method !== 'POST')) {
        return Response.json(productPayload);
      }
      if (url.includes('/api/v1/products/dental/sources') && init?.method === 'POST') {
        return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.', retryable: true } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return Response.json({ groups: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/products/dental?tab=overview');
    const user = userEvent.setup();
    await user.click(await screen.findByTestId('upload-artifact-button'));
    await user.type(screen.getByTestId('artifact-title-input'), 'Retryable Upload Artifact');
    await user.type(screen.getByTestId('artifact-date-input'), '2026-04-15');
    const file = new File(['deck'], 'dental-recovery-deck.pptx', { type: 'application/octet-stream' });
    await user.upload(screen.getByTestId('artifact-file-input'), file);
    await user.click(screen.getByTestId('artifact-submit'));

    expect(await screen.findByTestId('artifact-inline-error')).toBeVisible();
    expect(screen.getByTestId('artifact-retry-button')).toBeVisible();
    expect(screen.getByTestId('artifact-title-input')).toHaveValue('Retryable Upload Artifact');
  });
});
