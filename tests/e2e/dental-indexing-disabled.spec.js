import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental indexing kill switch publishes but warns Ask that retrieval is not ready', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableSemanticServicePath: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: false,
    },
  });

  await page.goto('/products/dental?tab=overview');
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });

  await page.goto(`/products/dental?tab=sources&sourceId=${uploaded.sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/disabled/i);
  await page.getByTestId('source-detail-drawer').getByRole('button', { name: 'Close' }).click();

  await page.getByTestId('product-tab-overview').click();
  await page.getByTestId('ask-input').fill('What did the vendor confirm?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('retrieval-not-ready-notice')).toBeVisible();
});
