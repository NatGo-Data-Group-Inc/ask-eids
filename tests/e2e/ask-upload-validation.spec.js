import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('ask button stays disabled for short queries', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('ask-input').fill('hi');
  await expect(page.getByTestId('ask-submit')).toBeDisabled();
});

test('transcript modal remains open with user metadata when upload fails validation', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-transcript-button').click();
  await expect(page.getByTestId('upload-transcript-modal')).toBeVisible();

  await page.getByTestId('transcript-title-input').fill('Validation Failure Transcript');
  await page.getByTestId('transcript-date-input').fill('2026-04-11');
  await page.getByTestId('transcript-file-input').setInputFiles({
    name: 'unsupported.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not-supported'),
  });
  await page.getByTestId('transcript-submit').click();

  await expect(page.getByTestId('upload-transcript-modal')).toBeVisible();
  await expect(page.getByTestId('transcript-title-input')).toHaveValue('Validation Failure Transcript');
  await expect(page.getByTestId('transcript-date-input')).toHaveValue('2026-04-11');
});
