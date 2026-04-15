import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('timeline filters, data expansion, and source detail all work live', async ({ page }) => {
  await page.goto('/products/dental?tab=timeline');
  await expect(page.getByTestId('timeline-view')).toBeVisible();

  await page.getByTestId('timeline-filter-email').click();
  await expect(page.getByTestId('timeline-entry-evt-src-50')).toBeVisible();
  await expect(page.getByTestId('timeline-entry-evt-src-51')).toHaveCount(0);

  await page.getByTestId('product-tab-data').click();
  await expect(page.getByTestId('data-view')).toBeVisible();
  await page.getByTestId('data-row-R-014').click();
  await expect(page.getByTestId('data-detail-R-014')).toHaveClass(/visible/);
  await page.getByTestId('data-row-R-016').click();
  await expect(page.getByTestId('data-detail-R-016')).toHaveClass(/visible/);
  await expect(page.getByTestId('data-detail-R-014')).not.toHaveClass(/visible/);

  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('sources-view')).toBeVisible();
  await page.getByTestId('source-filter-email').click();
  await page.getByTestId('source-item-src-50').click();
  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByText("Confirming today's outcome from the vendor recovery call.")).toBeVisible();
});
