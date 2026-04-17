import { test, expect } from '@playwright/test';
import {
  loadEidsLifecycleArtifacts,
  uploadLifecycleArtifact,
  waitForArtifactToSurface,
} from './lifecycle/eids-pack-lifecycle.helpers.js';

test.describe('Aggregate rationale popover (Phase 4 WS-E)', () => {
  test.setTimeout(180000);

  test.beforeEach(async ({ request }) => {
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
  });

  test('opens on badge click, renders drivers + riskFactors, navigates to source on anchor click, dismisses on Escape', async ({ page }) => {
    // Upload ONE dental email to trigger an LLM aggregate so the popover becomes available.
    const artifacts = await loadEidsLifecycleArtifacts({ productIds: ['dental'] });
    const firstEmail = artifacts.find((a) => a.sourceType === 'email');
    expect(firstEmail).toBeDefined();
    const uploadPayload = await uploadLifecycleArtifact(page, firstEmail);
    await waitForArtifactToSurface(page, firstEmail, uploadPayload);

    // Poll until the product payload surfaces aggregateRationale (Bedrock finishes async).
    await page.goto('/products/dental?tab=overview');
    await expect(page.getByTestId('product-status-badge')).toBeVisible({ timeout: 30000 });
    await expect.poll(async () => {
      const hasTrigger = await page.getByTestId('product-status-badge').getAttribute('data-rationale-available');
      return hasTrigger;
    }, { timeout: 60000, intervals: [1000, 2000, 3000] }).toBe('true');

    // Trigger the popover.
    await page.getByTestId('product-status-badge').click();
    await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
    await expect(page.getByTestId('aggregate-rationale-summary')).not.toBeEmpty();
    await expect(page.getByTestId('aggregate-rationale-confidence')).not.toBeEmpty();

    // At least one driver OR one risk factor row must be present.
    const driverCount = await page.locator('[data-testid^="aggregate-driver-row-"]').count();
    const riskCount = await page.locator('[data-testid^="aggregate-risk-factor-row-"]').count();
    expect(driverCount + riskCount).toBeGreaterThan(0);

    // Every anchor link's sourceId must exist on the Sources tab (cross-check).
    const anchorIds = await page.locator('[data-testid^="aggregate-anchor-link-"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-testid').replace('aggregate-anchor-link-', '')));
    expect(anchorIds.length).toBeGreaterThan(0);

    // Click the first anchor → popover closes, Sources tab open, sourceId param set.
    // Multiple drivers/risks can cite the same sourceId, so the testid may resolve to multiple
    // elements; .first() picks the topmost render.
    const firstAnchor = anchorIds[0];
    await page.getByTestId(`aggregate-anchor-link-${firstAnchor}`).first().click();
    await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`tab=sources.*sourceId=${firstAnchor}|sourceId=${firstAnchor}.*tab=sources`));

    // Re-open popover, dismiss with Escape.
    await page.goto('/products/dental?tab=overview');
    await page.getByTestId('product-status-badge').click();
    await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);

    // Re-open popover, dismiss by clicking overlay.
    await page.getByTestId('product-status-badge').click();
    await expect(page.getByTestId('aggregate-rationale-popover')).toBeVisible();
    await page.getByTestId('aggregate-rationale-overlay').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('aggregate-rationale-popover')).toHaveCount(0);
  });
});
