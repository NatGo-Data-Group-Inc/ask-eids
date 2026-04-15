import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('structured import updates data tab', async ({ page }) => {
  const csvPath = fixturePath('dental-risks-import.csv');

  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(csvPath);
  await page.getByTestId('artifact-source-type-select').selectOption('risk_export');
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('structured-impact-confirmation').check();
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-risks').click();
  await expect(page.getByTestId('data-import-impact-badge')).toBeVisible();
  await expect(page.getByTestId('data-row-R-IMP-001')).toBeVisible();
});
