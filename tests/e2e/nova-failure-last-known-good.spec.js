import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Failed extraction preserves prior Dental state', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-005, AC-BE-009, AC-BE-016, AC-INT-004
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableSemanticServicePath: false,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });
  await page.goto('/products/dental?tab=overview');
  const priorStatus = (await page.getByTestId('product-status-badge').textContent()) || '';
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'forced-invalid-extraction-email', testCase: 'forcedInvalidExtraction' });
  await expect(page.getByTestId('artifact-processing-error')).toBeVisible();
  await expect(page.getByTestId('product-status-badge')).toContainText(priorStatus);
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId(`source-item-${uploaded.sourceId}`)).toBeVisible();
});
