import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('narrative upload does not mutate structured tables', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');

  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-risks').click();
  await expect(page.getByTestId('data-import-impact-badge')).toHaveCount(0);
  await expect(page.getByTestId('data-row-R-014')).toBeVisible();
});
