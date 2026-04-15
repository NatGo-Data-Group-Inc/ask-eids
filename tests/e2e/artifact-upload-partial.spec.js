import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('partial artifact processing surfaces warnings', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');

  await page.goto('/products/dental?tab=overview&testCase=artifactPartial');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-processing-warning')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId('source-item-src-uploaded-deck').click();
  await expect(page.getByTestId('source-parser-warning')).toBeVisible();
});
