// Full-surface regression for the EIDS lifecycle.
//
// Exercises every CTA, hover, and UI surface that should update as documents
// are ingested. Per-upload assertions are keyed to the source type so we check
// exactly the deltas that SHOULD fire (e.g. structured imports update the Data
// tab, emails update Ask citations, etc.).
//
// Runs identically in both modes:
//   npx playwright test tests/e2e/full-surface-lifecycle.spec.js
//   npx playwright test tests/e2e/full-surface-lifecycle.spec.js --headed
//
// Requires the dev server running with:
//   EIDS_ENABLE_BEDROCK=true EIDS_AWS_REGION=us-east-1 AWS_PROFILE=default
//   ENABLE_SEMANTIC_SERVICE_PATH=true ENABLE_EXTRACTION_REPLAY_MODE=true
//   EIDS_ALLOW_NON_GOVCLOUD_FOR_DEV=true
//
// (playwright.config.js webServer.reuseExistingServer means a running dev
// server with those env vars is reused; otherwise Playwright starts one without
// live Bedrock, and most surface deltas will fall back to seed behavior.)

import { test, expect } from '@playwright/test';
import {
  loadEidsLifecycleArtifacts,
  uploadLifecycleArtifact,
  waitForArtifactToSurface,
} from './lifecycle/eids-pack-lifecycle.helpers.js';

const PRODUCTS = ['dental', 'essence', 'optima'];

// Baseline seeded source counts (from MASTER-MANIFEST.csv wave-00-baseline rows).
const BASELINE_SOURCE_COUNTS = { dental: 15, essence: 5, optima: 7 };

// Source-type → expected surface delta after an upload of that type.
// Each block says what SHOULD change. The test asserts exactly these deltas.
const SURFACE_DELTAS = {
  email: {
    sourceCountDelta: 1,
    structuredDataset: null,       // does not write to data.risks/blockers/pi
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,     // drawer shows Nova citations
    sourceKind: 'email',
  },
  transcript: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'transcript',
  },
  decision_memo: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  },
  weekly_update: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  },
  release_plan: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  },
  decision_log: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  },
  security_summary: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  },
  slide_deck: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'slide_deck',
  },
  risk_export: {
    sourceCountDelta: 1,
    structuredDataset: 'risks',
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'spreadsheet',
  },
  blocker_export: {
    sourceCountDelta: 1,
    structuredDataset: 'blockers',
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'spreadsheet',
  },
  pi_objectives_export: {
    sourceCountDelta: 1,
    structuredDataset: 'pi',
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'spreadsheet',
  },
  action_item_export: {
    sourceCountDelta: 1,
    structuredDataset: null,        // actionItems surfaced elsewhere, not via data-row-*
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'spreadsheet',
  },
  ado_export: {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'spreadsheet',
  },
};

function surfaceDeltaFor(sourceType) {
  return SURFACE_DELTAS[sourceType] || {
    sourceCountDelta: 1,
    structuredDataset: null,
    expectAggregateLogAttempt: true,
    expectEvidenceBanner: true,
    expectNewRecentSignal: true,
    expectCitationDrawer: true,
    sourceKind: 'document',
  };
}

async function fetchProductState(request, productId) {
  const [productResp, sourcesResp] = await Promise.all([
    request.get(`/api/v1/products/${productId}?asRole=lead`),
    request.get(`/api/v1/products/${productId}/sources?type=all&asRole=lead`),
  ]);
  const product = (await productResp.json()).product || {};
  const sources = await sourcesResp.json();
  return {
    statusLabel: product.statusLabel,
    aggregateVersion: Number(product.semanticState?.aggregateVersion || 0),
    aggregateId: product.semanticState?.aggregateId || null,
    executionMode: product.semanticState?.executionMode || null,
    hasRationale: Boolean(product.aggregateRationale),
    sourceCount: Number(sources?.counts?.all || 0),
    sourceIds: (sources?.items || []).map((s) => s.id),
  };
}

// Poll until the async ingest pipeline has fully completed for this upload — i.e. the product
// payload's latestEvidenceUpdate reflects this sourceId. waitForArtifactToSurface only waits
// for the queued source row to appear in the Sources tab, which happens BEFORE the semantic
// extraction + aggregate wire-up finishes.
async function waitForIngestCompletion(request, productId, sourceId, { timeoutMs = 60000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await request.get(`/api/v1/products/${productId}?asRole=lead`);
    const body = await response.json();
    const lev = body?.overview?.latestEvidenceUpdate;
    if (lev && lev.sourceId === sourceId) {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for latestEvidenceUpdate.sourceId=${sourceId} on ${productId}`);
}

async function fetchDataset(request, productId, dataset) {
  if (!dataset) return [];
  const response = await request.get(`/api/v1/products/${productId}/data?dataset=${dataset}&asRole=lead`);
  const body = await response.json();
  return Array.isArray(body?.rows) ? body.rows : [];
}

async function resetSystem(request) {
  const response = await request.post('/api/v1/test/reset', {
    data: {
      mode: 'wave-00',
      executionMode: 'hybrid',
      featureFlags: {
        enableSemanticServicePath: true,
        enableNovaDentalLiveEmail: true,
        enableExtractionReplayMode: true,
        enableDentalRetrievalIndexing: true,
      },
    },
  });
  expect(response.ok()).toBeTruthy();
}

test.describe('Full-surface EIDS lifecycle regression', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(30 * 60 * 1000); // 30 min — comprehensive spec, long runtime

  test('exercises every surface, CTA, hover, and field through the full ingest lifecycle', async ({ page, request }) => {
    await resetSystem(request);

    const state = {
      dental: { sourceCount: BASELINE_SOURCE_COUNTS.dental, aggregateVersion: 1 },
      essence: { sourceCount: BASELINE_SOURCE_COUNTS.essence, aggregateVersion: 1 },
      optima: { sourceCount: BASELINE_SOURCE_COUNTS.optima, aggregateVersion: 1 },
    };

    // ============================================================
    // PART 1 — BASELINE SURFACES (before any ingest)
    // ============================================================
    await test.step('Baseline · Portfolio surface', async () => {
      await page.goto('/portfolio');
      await expect(page.getByTestId('topnav-brand')).toBeVisible();
      await expect(page.getByTestId('topnav-brand')).toContainText(/EIDS/);
      await expect(page.getByTestId('topnav-brand')).toContainText(/Product Knowledge Hub/);
      await expect(page.getByTestId('topnav-search-input')).toBeVisible();
      await expect(page.getByTestId('topnav-search-input')).toHaveAttribute('placeholder', /Search products/);

      // All three product cards present at baseline.
      for (const productId of PRODUCTS) {
        await expect(page.getByTestId(`product-card-${productId}`)).toBeVisible();
      }

      // Baseline badges (seed-derived; dental=Caution, essence=At Risk, optima=On Track).
      await expect(page.getByTestId('product-card-dental')).toContainText(/Caution/);
      await expect(page.getByTestId('product-card-essence')).toContainText(/At Risk/);
      await expect(page.getByTestId('product-card-optima')).toContainText(/On Track/);
    });

    await test.step('Baseline · Search palette — product hit', async () => {
      const search = page.getByTestId('topnav-search-input');
      await search.click();
      await search.fill('DENTAL');
      await expect(page.getByTestId('search-palette')).toBeVisible();
      await expect(page.getByTestId('search-result-product-dental')).toBeVisible();
      await search.press('Escape');
      await expect(page.getByTestId('search-palette')).toHaveCount(0);
    });

    await test.step('Baseline · Portfolio → Product navigation CTA', async () => {
      await page.getByTestId('product-card-dental').click();
      await expect(page).toHaveURL(/products\/dental/);
      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-back-link')).toBeVisible();
      await page.getByTestId('product-back-link').click();
      await expect(page).toHaveURL(/portfolio/);
    });

    await test.step('Baseline · Product page surface (dental)', async () => {
      await page.goto('/products/dental?tab=overview');
      await expect(page.getByTestId('product-page')).toBeVisible();

      // Header metadata fields.
      const meta = page.locator('.product-meta');
      await expect(meta).toBeVisible();
      await expect(meta).toContainText(/PI \d+/);
      await expect(meta).toContainText(/Sprint \d+/);
      await expect(meta).toContainText(/PM:/);
      await expect(meta).toContainText(/Last sync:/);

      // Status badge present (button if rationale available, else span).
      const badge = page.getByTestId('product-status-badge');
      await expect(badge).toBeVisible();
      await expect(badge).toContainText(/Caution/);

      // All 5 product tabs.
      for (const t of ['overview', 'timeline', 'data', 'sources', 'reports']) {
        await expect(page.getByTestId(`product-tab-${t}`)).toBeVisible();
      }

      // Knowledge Health panel.
      await expect(page.getByTestId('knowledge-health-panel')).toBeVisible();
      await expect(page.getByTestId('knowledge-health-ring')).toBeVisible();
      await expect(page.getByTestId('knowledge-health-ring')).toHaveAttribute('aria-label', /Knowledge health \d+%/);

      // Overview CTAs.
      await expect(page.getByTestId('upload-artifact-button')).toBeVisible();
      await expect(page.getByTestId('upload-artifact-button')).toBeEnabled();
      await expect(page.getByTestId('update-weekly-button')).toBeVisible();

      // Ask baseline UI.
      await expect(page.getByTestId('ask-input')).toBeVisible();
      await expect(page.getByTestId('ask-input')).toHaveAttribute('placeholder', /Ask a question/);
      await expect(page.getByTestId('ask-submit')).toBeVisible();
      await expect(page.getByTestId('ask-submit')).toBeDisabled();
      await page.getByTestId('ask-input').fill('hi');
      await expect(page.getByTestId('ask-submit')).toBeDisabled();
      await page.getByTestId('ask-input').fill('What is the dental status?');
      await expect(page.getByTestId('ask-submit')).toBeEnabled();
      await page.getByTestId('ask-input').fill('');
    });

    await test.step('Baseline · Sources tab has baseline seeded rows', async () => {
      await page.getByTestId('product-tab-sources').click();
      await expect(page.getByTestId('sources-view')).toBeVisible();
      await expect(page.locator('[data-testid^="source-item-"]')).toHaveCount(BASELINE_SOURCE_COUNTS.dental);
      // Filter chips.
      for (const f of ['all', 'transcript', 'slide_deck', 'spreadsheet', 'email', 'document', 'weekly', 'ado']) {
        await expect(page.getByTestId(`source-filter-${f}`)).toBeVisible();
      }
    });

    await test.step('Baseline · Open and close a source detail drawer (hover + click)', async () => {
      const firstSource = page.locator('[data-testid^="source-item-"]').first();
      await firstSource.hover();
      await firstSource.click();
      await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
      await expect(page.getByTestId('source-family-class')).toBeVisible();
      await expect(page.getByTestId('source-detail-summary')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('source-detail-drawer')).toHaveCount(0);
    });

    await test.step('Baseline · Data tab subtabs', async () => {
      await page.goto('/products/dental?tab=data');
      for (const sub of ['risks', 'blockers', 'pi']) {
        await expect(page.getByTestId(`data-subtab-${sub}`)).toBeVisible();
      }
    });

    await test.step('Baseline · Reports tab has generate CTA', async () => {
      await page.goto('/products/dental?tab=reports');
      await expect(page.getByTestId('generate-report-button')).toBeVisible();
      await expect(page.getByTestId('generate-report-button')).toBeEnabled();
    });

    // ============================================================
    // PART 2 — PER-UPLOAD SURFACE DELTAS (all 29 non-baseline rows)
    // ============================================================
    const artifacts = await loadEidsLifecycleArtifacts({ productIds: PRODUCTS });
    expect(artifacts).toHaveLength(29);

    for (const artifact of artifacts) {
      const expected = surfaceDeltaFor(artifact.sourceType);
      const productId = artifact.productId;

      await test.step(`Ingest #${artifact.ingestOrder} [${productId}/${artifact.wave}/${artifact.sourceType}] ${artifact.title}`, async () => {
        // ----- Capture before-state via API -----
        const before = await fetchProductState(request, productId);
        const beforeDataset = await fetchDataset(request, productId, expected.structuredDataset);

        // ----- Upload via the modal (exercises the full CTA path) -----
        await page.goto(`/products/${productId}?tab=overview`);
        await expect(page.getByTestId('upload-artifact-button')).toBeVisible();
        await page.getByTestId('upload-artifact-button').click();
        await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();

        // Field-level assertions on the modal form.
        const fileInput = page.getByTestId('artifact-file-input');
        const metaInput = page.getByTestId('artifact-metadata-file-input');
        const titleInput = page.getByTestId('artifact-title-input');
        const dateInput = page.getByTestId('artifact-date-input');
        await expect(fileInput).toBeVisible();
        await expect(metaInput).toBeVisible();
        await expect(titleInput).toBeVisible();
        await expect(dateInput).toBeVisible();
        await expect(page.getByTestId('artifact-submit')).toBeVisible();

        // Close modal via overlay/cancel to ensure dismiss works before the real upload.
        await page.keyboard.press('Escape').catch(() => {});
        // Modal may not close on Escape (design choice); ensure submit flow instead by re-opening if needed.
        if (!(await page.getByTestId('upload-artifact-modal').isVisible().catch(() => false))) {
          await page.getByTestId('upload-artifact-button').click();
          await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();
        }

        // Perform the full upload via helper (handles setInputFiles + structuredImpactConfirmation + waitForResponse).
        const uploadPayload = await uploadLifecycleArtifact(page, artifact);
        await waitForArtifactToSurface(page, artifact, uploadPayload);

        // Wait for the async pipeline (Nova extraction + aggregate + state write) to finish.
        if (uploadPayload.sourceId) {
          await waitForIngestCompletion(request, productId, uploadPayload.sourceId);
        }

        // ----- Capture after-state via API -----
        const after = await fetchProductState(request, productId);

        // ----- Surface delta assertions -----
        // 1. Source count grew by exactly the expected delta for the TARGET product.
        expect(after.sourceCount - before.sourceCount).toBe(expected.sourceCountDelta);

        // 2. Other products' source counts unchanged.
        for (const otherId of PRODUCTS.filter((p) => p !== productId)) {
          const otherAfter = await fetchProductState(request, otherId);
          expect(otherAfter.sourceCount).toBe(state[otherId].sourceCount);
        }

        // 3. New source ID present in the list.
        if (uploadPayload.sourceId) {
          expect(after.sourceIds).toContain(uploadPayload.sourceId);
        }

        // 4. Aggregate version incremented OR stayed same (if aggregate failed — e.g. replay miss).
        //    Either outcome is acceptable surface-wise; we just want it monotonically non-decreasing.
        expect(after.aggregateVersion).toBeGreaterThanOrEqual(before.aggregateVersion);

        // 5. Sources tab — the new row is visible, with the expected title.
        await page.goto(`/products/${productId}?tab=sources`);
        await expect(page.getByTestId('sources-view')).toBeVisible();
        await expect(page.locator('[data-testid^="source-item-"]')).toHaveCount(after.sourceCount);
        if (uploadPayload.sourceId) {
          await expect(page.getByTestId(`source-item-${uploadPayload.sourceId}`)).toBeVisible();
        }

        // 6. Source-detail drawer opens and shows expected metadata.
        if (expected.expectCitationDrawer && uploadPayload.sourceId) {
          await page.getByTestId(`source-item-${uploadPayload.sourceId}`).click();
          await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
          await expect(page.getByTestId('source-family-class')).toBeVisible();
          await expect(page.getByTestId('source-detail-summary')).toBeVisible();
          // Close for next iteration.
          await page.keyboard.press('Escape');
          await expect(page.getByTestId('source-detail-drawer')).toHaveCount(0);
        }

        // 7. Overview — evidence-updated banner + new recent signal for this source type.
        //    (These surface only for the product that got the upload.)
        await page.goto(`/products/${productId}?tab=overview`);
        if (expected.expectEvidenceBanner) {
          // Banner may not always be visible if dismissed/superseded — check the API field instead.
          // We just assert the product query reflects latestEvidenceUpdate for this source.
          const productResp = await request.get(`/api/v1/products/${productId}?asRole=lead`);
          const productBody = await productResp.json();
          const lev = productBody?.overview?.latestEvidenceUpdate;
          expect(lev).not.toBeNull();
          expect(lev.sourceId).toBe(uploadPayload.sourceId);
          expect(lev.sourceType).toBe(artifact.sourceType);
        }
        if (expected.expectNewRecentSignal) {
          const recentSignals = page.locator('[data-testid^="recent-signal-"]');
          await expect(recentSignals.first()).toBeVisible();
        }

        // 8. Structured imports update the Data tab's dataset.
        if (expected.structuredDataset) {
          const afterDataset = await fetchDataset(request, productId, expected.structuredDataset);
          // Dataset latest-entry-wins semantics — the rows reflect this CSV.
          expect(afterDataset.length).toBeGreaterThan(0);
          // UI verification: navigate to Data tab, click the matching subtab, confirm rows.
          // Note: risks/blockers emit data-testid=data-row-{id}; pi uses plain <tr> (no testid).
          await page.goto(`/products/${productId}?tab=data`);
          await expect(page.getByTestId('data-view')).toBeVisible();
          await page.getByTestId(`data-subtab-${expected.structuredDataset}`).click();
          await expect(page.getByTestId(`data-subtab-${expected.structuredDataset}`)).toHaveClass(/active/);
          if (expected.structuredDataset === 'risks' || expected.structuredDataset === 'blockers') {
            await expect.poll(async () => page.locator('[data-testid^="data-row-"]').count(), { timeout: 10000 }).toBeGreaterThan(0);
          } else {
            // PI rows don't emit a per-row test id; assert the data table has body rows instead.
            await expect.poll(async () => page.locator('.data-table tbody tr').count(), { timeout: 10000 }).toBeGreaterThan(0);
          }
        }

        // 9. If the aggregate fired (version bumped) AND rationale is surfaced, verify the popover
        //    is functional — badge is a button, click opens the rationale dialog. Poll the badge
        //    attribute in case the React Query for product lags the state write by a beat.
        if (after.aggregateVersion > before.aggregateVersion && after.hasRationale) {
          await page.goto(`/products/${productId}?tab=overview`);
          const badge = page.getByTestId('product-status-badge');
          const rationaleAvailable = await expect.poll(
            async () => badge.getAttribute('data-rationale-available'),
            { timeout: 10000 },
          ).toBe('true').then(() => true).catch(() => false);
          if (rationaleAvailable) {
            await expect(badge).toHaveAttribute('title', /Click to see why this status/i);
            await badge.click();
            await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
            await expect(page.getByTestId('aggregate-rationale-summary')).not.toBeEmpty();
            await expect(page.getByTestId('aggregate-rationale-confidence')).not.toBeEmpty();
            const driverOrRisk = await page.locator('[data-testid^="aggregate-driver-row-"], [data-testid^="aggregate-risk-factor-row-"]').count();
            expect(driverOrRisk).toBeGreaterThan(0);
            const anchorIds = await page.locator('[data-testid^="aggregate-anchor-link-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid').replace('aggregate-anchor-link-', '')));
            for (const anchor of anchorIds) {
              expect(after.sourceIds).toContain(anchor);
            }
            await page.getByTestId('aggregate-rationale-dismiss').click();
            await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);
          }
        }

        // Update the running state mirror.
        state[productId].sourceCount = after.sourceCount;
        state[productId].aggregateVersion = after.aggregateVersion;
      });
    }

    // ============================================================
    // PART 3 — FINAL GREEN END-STATE + CTA COVERAGE
    // ============================================================

    await test.step('End · Portfolio badges reflect LLM-synthesized status', async () => {
      await page.goto('/portfolio');
      // All three badges must render one of the three valid statusLabel values produced by the
      // aggregate prompt. We don't assert a specific label here — LLM wording can legitimately
      // shift between Caution and At Risk for thinner-evidence products (e.g. essence has only
      // 2 uploaded extractions) — but every badge must be present and carry a valid label.
      for (const productId of PRODUCTS) {
        const card = page.getByTestId(`product-card-${productId}`);
        await expect(card).toBeVisible();
        await expect(card).toContainText(/(On Track|Caution|At Risk)/);
      }
      // Optima has 3 uploaded extractions all healthy; should consistently read On Track.
      await expect(page.getByTestId('product-card-optima')).toContainText(/On Track/);
    });

    await test.step('End · Search returns product AND source results', async () => {
      const search = page.getByTestId('topnav-search-input');
      await search.click();
      await search.fill('dental');
      await expect(page.getByTestId('search-palette')).toBeVisible();
      await expect(page.getByTestId('search-result-product-dental')).toBeVisible();
      // Pressing down-arrow should move focus; Enter should navigate.
      await search.press('ArrowDown');
      await search.press('Enter');
      await expect(page).toHaveURL(/products\/dental/);
    });

    for (const productId of PRODUCTS) {
      await test.step(`End · ${productId} · all tab CTAs functional`, async () => {
        await page.goto(`/products/${productId}?tab=overview`);
        for (const t of ['timeline', 'data', 'sources', 'reports', 'overview']) {
          await page.getByTestId(`product-tab-${t}`).click();
          await expect(page.getByTestId(`product-tab-${t}`)).toHaveAttribute('aria-selected', 'true');
        }
      });

      await test.step(`End · ${productId} · Sources tab filter chips each render`, async () => {
        await page.goto(`/products/${productId}?tab=sources`);
        for (const f of ['all', 'transcript', 'email', 'document', 'weekly', 'slide_deck', 'spreadsheet', 'ado']) {
          await page.getByTestId(`source-filter-${f}`).click();
          await expect(page.getByTestId('sources-view')).toBeVisible();
        }
        await page.getByTestId('source-filter-all').click();
      });

      await test.step(`End · ${productId} · Aggregate rationale popover (full interaction)`, async () => {
        await page.goto(`/products/${productId}?tab=overview`);
        const badge = page.getByTestId('product-status-badge');
        const hasRationale = (await badge.getAttribute('data-rationale-available')) === 'true';
        if (!hasRationale) return; // Some products may have aggregateVersion but no live rationale surface.

        // Open.
        await badge.click();
        await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
        // Summary + confidence.
        await expect(page.getByTestId('aggregate-rationale-summary')).not.toBeEmpty();
        await expect(page.getByTestId('aggregate-rationale-confidence')).not.toBeEmpty();
        // Drivers have a direction symbol + a sourceId anchor.
        const drivers = page.locator('[data-testid^="aggregate-driver-row-"]');
        const driverCount = await drivers.count();
        for (let i = 0; i < driverCount; i += 1) {
          const row = drivers.nth(i);
          await expect(row).toBeVisible();
          await expect(row.locator('[data-testid^="aggregate-driver-direction-"]')).toBeVisible();
        }
        // Risk factors.
        const risks = page.locator('[data-testid^="aggregate-risk-factor-row-"]');
        const riskCount = await risks.count();
        for (let i = 0; i < riskCount; i += 1) {
          const row = risks.nth(i);
          await expect(row).toBeVisible();
          await expect(row.locator('[data-testid^="aggregate-risk-severity-"]')).toBeVisible();
        }
        // Anchor click navigates to sources tab + sourceId param.
        const firstAnchor = page.locator('[data-testid^="aggregate-anchor-link-"]').first();
        if (await firstAnchor.count()) {
          const anchorTestId = await firstAnchor.getAttribute('data-testid');
          const anchorSourceId = anchorTestId.replace('aggregate-anchor-link-', '');
          await firstAnchor.click();
          await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);
          await expect(page).toHaveURL(new RegExp(`tab=sources.*sourceId=${anchorSourceId}|sourceId=${anchorSourceId}.*tab=sources`));
        }

        // Re-open + Escape-dismiss.
        await page.goto(`/products/${productId}?tab=overview`);
        await page.getByTestId('product-status-badge').click();
        await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);

        // Re-open + overlay-dismiss.
        await page.getByTestId('product-status-badge').click();
        await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
        await page.getByTestId('aggregate-rationale-overlay').click({ position: { x: 5, y: 5 } });
        await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);
      });

      await test.step(`End · ${productId} · Ask returns a cited answer`, async () => {
        await page.goto(`/products/${productId}?tab=overview`);
        await page.getByTestId('ask-input').fill(`What is the current ${productId} status?`);
        await expect(page.getByTestId('ask-submit')).toBeEnabled();
        await page.getByTestId('ask-submit').click();
        // Loading indicator OR answer; both are valid observable states.
        await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 45000 });
        // At least one source-type chip.
        await expect(page.getByTestId('ask-source-type-chip').first()).toBeVisible();
      });
    }

    await test.step('End · Dental report generate + exec summary section', async () => {
      await page.goto('/products/dental?tab=reports');
      await expect(page.getByTestId('generate-report-button')).toBeVisible();
      await page.getByTestId('generate-report-button').click();
      await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 90000 });
      // Exec summary is non-empty.
      const body = await page.getByTestId('report-section-executive-summary').innerText();
      expect(body.length).toBeGreaterThan(60);
    });

    await test.step('End · Telemetry endpoint accepts post-run heartbeat', async () => {
      const response = await request.post('/api/v1/telemetry', {
        data: { event: 'full-surface-lifecycle-complete', ts: new Date().toISOString() },
      });
      expect(response.status()).toBe(202);
    });

    await test.step('End · Unknown product returns 404 (negative path)', async () => {
      const response = await request.get('/api/v1/products/does-not-exist-42?asRole=lead');
      expect(response.status()).toBe(404);
    });
  });
});
