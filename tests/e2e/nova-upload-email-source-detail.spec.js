import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Uploading a Dental email produces extraction-backed source detail', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-006, AC-FE-007, AC-FE-009, AC-INT-002
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
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave01-vendor-delay-email' });
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId(`source-item-${uploaded.sourceId}`).click();
  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('source-detail-summary')).toBeVisible();
  await expect(page.getByTestId('source-detail-citations')).toContainText(/line|page|slide|row/i);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/indexed/i);
});
