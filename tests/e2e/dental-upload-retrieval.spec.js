import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Retrieval-eligible Dental upload becomes citable without reset', async ({ page, request }) => {
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

  await page.goto('/products/dental?tab=overview');
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await expect(page.getByTestId('overview-current-state')).toBeVisible();

  await page.goto(`/products/dental?tab=sources&sourceId=${uploaded.sourceId}`);
  await expect(page.getByTestId('source-indexing-status')).toContainText(/indexed/i);
  await page.getByTestId('source-detail-drawer').getByRole('button', { name: 'Close' }).click();

  await page.getByTestId('product-tab-overview').click();
  await page.getByTestId('ask-input').fill('What did the vendor confirm?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.locator('[data-testid="ask-source-type-chip"]').filter({ hasText: 'vector' }).first()).toBeVisible();
});
