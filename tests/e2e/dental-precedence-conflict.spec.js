import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Ask renders structured field-of-record precedence when structured and narrative conflict on an exact field', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await page.goto('/products/dental?tab=overview&testCase=precedenceConflict');
  await page.getByTestId('ask-input').fill('When is the mitigation due?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-structured-row-badge').first()).toBeVisible();
  await expect(page.getByTestId('ask-precedence-note').first()).toBeVisible();
  await expect(page.locator('[data-testid="ask-source-type-chip"]').first()).toContainText(/structured/i);
});
