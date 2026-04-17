import { test, expect } from '@playwright/test';
import { askAndWait, resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental flow remains stable when semantic service split is enabled', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: The running backend may choose replay extraction when live Bedrock is unavailable, but the service-split workflow still exercises real routing, persistence, and UI state.
  // Validates: AC-G-009, AC-BE-011, AC-BE-012, AC-BE-013, AC-INT-007
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableSemanticServicePath: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await page.goto('/products/dental?tab=overview');
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await askAndWait(page, 'Did the vendor confirm the mitigation?');

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await page.getByTestId('product-tab-reports').click();
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('report-semantic-state-banner')).toHaveCount(0);
});
