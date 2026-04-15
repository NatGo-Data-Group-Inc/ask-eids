import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('source detail drawer renders type-aware metadata and restores focus', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');

  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-submit').click();
  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });

  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('source-item-src-uploaded-deck')).toBeVisible();
  await expect(page.getByTestId('source-item-src-uploaded-deck')).toContainText('slide deck');
  await page.getByTestId('source-item-src-uploaded-deck').focus();
  await page.getByTestId('source-item-src-uploaded-deck').press('Enter');

  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('source-preview-content')).toBeVisible();
  await expect(page.getByTestId('source-download-original')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('source-detail-drawer')).toHaveCount(0);
  await expect(page.getByTestId('source-item-src-uploaded-deck')).toBeFocused();
});
