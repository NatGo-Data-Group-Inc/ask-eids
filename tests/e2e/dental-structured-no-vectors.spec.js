import { test, expect } from '@playwright/test';
import { countRagChunksForSource, resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Fixed-schema structured Dental upload does not write rag chunks', async ({ page, request }) => {
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-01',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave02-blockers-export' });
  const chunkCount = await countRagChunksForSource(request, { sourceId: uploaded.sourceId });
  expect(chunkCount).toBe(0);

  await page.goto(`/products/dental?tab=sources&sourceId=${uploaded.sourceId}`);
  await expect(page.getByTestId('source-family-class')).toContainText(/fixed_schema_structured/i);
  await expect(page.getByTestId('source-indexing-status')).toHaveCount(0);
  await page.getByTestId('source-detail-drawer').getByRole('button', { name: 'Close' }).click();

  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-blockers').click();
  await expect(page.getByTestId('data-row-B-003')).toBeVisible();
});
