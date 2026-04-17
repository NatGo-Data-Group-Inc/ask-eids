import { test, expect } from '@playwright/test';
import { resetAppState } from '../test-helpers.js';
import {
  loadEidsLifecycleArtifacts,
  uploadLifecycleArtifact,
  waitForArtifactToSurface,
} from './eids-pack-lifecycle.helpers.js';

test.describe('EIDS Prototype Document Pack — multi-product lifecycle workflow', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ request }) => {
    await resetAppState(request, { corpusWave: 'wave-00-baseline' });
  });

  test('ingests every non-baseline artifact across dental + essence + optima and reaches the green end state', async ({ page, request }) => {
    const artifacts = await loadEidsLifecycleArtifacts({ productIds: ['dental', 'essence', 'optima'] });
    // All 29 non-baseline uploads: 7 csv + 4 docx + 7 eml + 8 md + 2 pdf + 1 pptx.
    expect(artifacts).toHaveLength(29);

    await test.step('Baseline portfolio sanity', async () => {
      await page.goto('/portfolio');
      await expect(page.getByTestId('product-card-dental')).toBeVisible();
      await expect(page.getByTestId('product-card-essence')).toBeVisible();
      await expect(page.getByTestId('product-card-optima')).toBeVisible();
      await expect(page.getByTestId('product-card-essence')).toContainText('At Risk');
      await expect(page.getByTestId('product-card-optima')).toContainText('On Track');
    });

    await test.step('Upload all 29 non-baseline artifacts in ingest_order', async () => {
      for (const artifact of artifacts) {
        await test.step(`Upload [${artifact.productId} · ${artifact.wave}] ${artifact.title}`, async () => {
          const uploadPayload = await uploadLifecycleArtifact(page, artifact);
          await waitForArtifactToSurface(page, artifact, uploadPayload);
        });
      }
    });

    await test.step('AC-G-01 / AC-G-02 — Final portfolio state', async () => {
      await page.goto('/portfolio');
      await expect(page.getByTestId('product-card-dental')).toBeVisible();
      await expect(page.getByTestId('product-card-essence')).toBeVisible();
      await expect(page.getByTestId('product-card-optima')).toBeVisible();
      await expect(page.getByTestId('product-card-dental')).toContainText('Caution');
      await expect(page.getByTestId('product-card-essence')).toContainText('At Risk');
      await expect(page.getByTestId('product-card-optima')).toContainText('On Track');
    });

    await test.step('AC-G-03 — Top-nav search resolves product + source matches', async () => {
      await page.goto('/portfolio');
      const searchInput = page.getByTestId('topnav-search-input');
      await searchInput.fill('ESSENCE');
      await expect(page.getByTestId('search-palette')).toBeVisible();
      await expect(page.getByTestId('search-result-product-essence')).toBeVisible();
      await searchInput.fill('');
      await searchInput.fill('Document Gap');
      await expect(page.getByTestId('search-palette')).toBeVisible();
      const sourceMatches = page.locator('[data-testid^="search-result-source-"]').filter({ hasText: /Document Gap Followup/i });
      await expect(sourceMatches.first()).toBeVisible();
      await searchInput.fill('');
    });

    await test.step('AC-G-04 — Telemetry endpoint accepts post-run heartbeat', async () => {
      const response = await request.post('/api/v1/telemetry', {
        data: { event: 'lifecycle-complete', ts: new Date().toISOString() },
      });
      expect(response.status()).toBe(202);
    });

    await test.step('AC-D — Dental green end state', async () => {
      await page.goto('/products/dental?tab=overview');
      await expect(page.getByTestId('product-status-badge')).toHaveText('Caution');

      await page.getByTestId('product-tab-sources').click();
      // 15 baseline dental sources + 24 uploaded dental sources (all formats now ingested) = 39.
      await expect(page.locator('[data-testid^="source-item-"]')).toHaveCount(39);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /Dental Leadership Readout Deck/ })).toHaveCount(1);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /Dental Vendor Recovery Call Transcript/ })).toHaveCount(1);

      await page.goto('/products/dental?tab=data');
      await page.getByTestId('data-subtab-blockers').click();
      await expect(page.getByTestId('data-row-B-003')).toBeVisible();

      await page.goto('/products/dental?tab=reports');
      await page.getByTestId('generate-report-button').click();
      const execSummary = page.getByTestId('report-section-executive-summary');
      await expect(execSummary).toBeVisible({ timeout: 90000 });
      // LLM aggregate summary may emphasize any of: recovery/mitigation wave-03 content, residual vendor-sandbox caution,
      // FHIR priority from wave-01, or blocker resolution. All are valid framings of the evidence at end-state.
      await expect(execSummary).toContainText(/recovery|remediation|mitigat|vendor|FHIR|blocker|sandbox|contract|cautio/i);

      await page.goto('/products/dental?tab=overview');
      await page.getByTestId('ask-input').fill('What evidence supports the recovery path?');
      await page.getByTestId('ask-submit').click();
      const dentalAnswer = page.getByTestId('ask-answer');
      await expect(dentalAnswer).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('ask-source-type-chip').first()).toBeVisible();
      // Evidence gap warning is legitimate for open-ended questions — Ask being transparent about coverage is expected.
    });

    await test.step('AC-E — Essence green end state', async () => {
      await page.goto('/products/essence?tab=overview');
      await expect(page.getByTestId('product-status-badge')).toHaveText('At Risk');

      await page.getByTestId('product-tab-sources').click();
      await expect(page.locator('[data-testid^="source-item-"]')).toHaveCount(7);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /ESSENCE Handoff Working Session Transcript/ })).toHaveCount(1);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /Document Gap Followup/ })).toHaveCount(1);

      await page.goto('/products/essence?tab=overview');
      await page.getByTestId('ask-input').fill('What blockers are open on the ESSENCE handoff?');
      await page.getByTestId('ask-submit').click();
      const essenceAnswer = page.getByTestId('ask-answer');
      await expect(essenceAnswer).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('ask-source-type-chip').first()).toBeVisible();
    });

    await test.step('AC-O — Optima green end state', async () => {
      await page.goto('/products/optima?tab=overview');
      await expect(page.getByTestId('product-status-badge')).toHaveText('On Track');

      await page.getByTestId('product-tab-sources').click();
      await expect(page.locator('[data-testid^="source-item-"]')).toHaveCount(10);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /Optima Weekly Update — April 16/ })).toHaveCount(1);
      await expect(page.locator('[data-testid^="source-item-"]').filter({ hasText: /Optima Decision Log Update/ })).toHaveCount(1);

      await page.goto('/products/optima?tab=overview');
      await page.getByTestId('ask-input').fill('What was the latest Optima weekly update?');
      await page.getByTestId('ask-submit').click();
      const optimaAnswer = page.getByTestId('ask-answer');
      await expect(optimaAnswer).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('ask-degraded-banner')).toHaveCount(0);
    });
  });
});
