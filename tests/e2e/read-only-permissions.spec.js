import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('read only user does not see edit or upload controls', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&asRole=read');
  await expect(page.getByTestId('upload-artifact-button')).toHaveCount(0);
  await expect(page.getByTestId('update-weekly-button')).toHaveCount(0);

  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('sources-view')).toBeVisible();

  await page.goto('/products/dental?tab=reports&asRole=read');
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('report-edit-executive-summary')).toHaveCount(0);
  await expect(page.getByTestId('export-pdf')).toBeVisible();
});
