import { test, expect } from '@playwright/test';
import { fixturePath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('existing report requires explicit regeneration after new evidence', async ({ page }) => {
  const deckPath = fixturePath('dental-recovery-deck.pptx');

  await page.goto('/products/dental?tab=reports&reportId=rep-seeded');
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible();

  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(deckPath);
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-submit').click();
  await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 15000 });

  await page.goto('/products/dental?tab=reports&reportId=rep-seeded');
  await expect(page.getByTestId('report-regenerate-notice')).toBeVisible();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible();
  await expect(page.getByTestId('report-regenerate-button')).toBeVisible();
});
