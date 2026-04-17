import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Dental baseline renders from extraction-first state', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-001, AC-FE-002, AC-INT-001
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: false,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });
  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page.getByTestId('knowledge-health-panel')).toBeVisible();
  await expect(page.getByTestId('semantic-freshness-badge')).toBeVisible();
  await expect(page.getByTestId('overview-current-state')).toBeVisible();
});
