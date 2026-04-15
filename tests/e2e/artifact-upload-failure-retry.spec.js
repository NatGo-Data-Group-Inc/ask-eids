import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('artifact upload shows retryable scoped error', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');

  await page.goto('/products/dental?tab=overview&testCase=artifactUploadFailure');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-title-input').fill('Retryable Upload Artifact');
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('artifact-inline-error')).toBeVisible();
  await expect(page.getByTestId('artifact-retry-button')).toBeVisible();
  await expect(page.getByTestId('artifact-title-input')).toHaveValue('Retryable Upload Artifact');
  await page.getByTestId('artifact-retry-button').click();
  await expect(page.getByTestId('toast-success')).toContainText('Artifact queued');
});
