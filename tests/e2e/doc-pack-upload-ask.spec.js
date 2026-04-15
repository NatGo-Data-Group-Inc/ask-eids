import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('uploaded artifact appears in search and ask', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');
  const title = `Dental Leadership Readout Deck ${Date.now()}`;

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-page')).toBeVisible();

  await page.getByTestId('upload-artifact-button').click();
  await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-title-input').fill(title);
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Artifact queued');
  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });

  await page.getByTestId('topnav-search-input').fill('Leadership Readout');
  await expect(page.getByTestId('search-palette')).toBeVisible();
  await expect(page.getByTestId('search-result-source-src-uploaded-deck')).toBeVisible({ timeout: 15000 });

  await page.getByTestId('product-tab-overview').click();
  await page.getByTestId('ask-input').fill('What changed in the leadership readout deck?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-loading')).toBeVisible();
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toBeVisible();
  await expect(page.getByTestId('ask-answer')).toContainText('Evidence-backed response');
});
