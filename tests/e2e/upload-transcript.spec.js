import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('artifact upload happy path', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');
  const title = `Dental Leadership Readout Deck ${Date.now()}`;

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('upload-artifact-button')).toBeVisible();
  await page.getByTestId('upload-artifact-button').click();
  await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await expect(page.getByTestId('artifact-source-type-select')).toHaveValue('slide_deck');
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-title-input').fill(title);
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Artifact queued');
  await expect(page.getByTestId('artifact-processing-status')).toContainText(title);
  await expect(page.getByTestId('artifact-processing-status')).toContainText(/queued|processing|completed/i);
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByText(title)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });
});
