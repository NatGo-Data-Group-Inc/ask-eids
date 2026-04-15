import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('generate edit and export report', async ({ page }) => {
  const updatedText = `Updated executive summary text ${Date.now()}`;

  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();

  await expect(page.getByTestId('report-loading')).toBeVisible();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });

  await page.getByTestId('report-edit-executive-summary').click();
  await page.getByTestId('report-edit-textarea-executive-summary').fill(updatedText);
  await page.getByTestId('report-save-executive-summary').click();
  await expect(page.getByTestId('toast-success')).toContainText('saved');

  await page.reload();
  await expect(page.getByTestId('report-section-executive-summary')).toContainText(updatedText);

  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('export-pdf').click();
  await expect(page.getByTestId('export-pdf')).toHaveAttribute('aria-busy', 'true');
  const popup = await popupPromise;
  await popup.close();
  await expect(page.getByTestId('toast-success')).toContainText('PDF export started');
});
