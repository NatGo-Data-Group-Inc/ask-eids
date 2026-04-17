import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental reports regenerate from updated aggregate state', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-014, AC-FE-015, AC-INT-006
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: false,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });
  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  const reportUrl = page.url();
  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await page.goto(reportUrl);
  await expect(page.getByTestId('report-regenerate-notice')).toBeVisible();
  await page.getByTestId('report-regenerate-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
});
