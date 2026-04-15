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

test('artifact upload validation failures', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('upload-artifact-button').click();
  await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();

  await page.getByTestId('artifact-submit').click();
  await expect(page.getByTestId('artifact-file-error')).toContainText('Choose an artifact file');
  await expect(page.getByTestId('artifact-date-error')).toContainText('Choose a source date');

  await page.getByTestId('artifact-title-input').fill('Validation Failure Artifact');
  await page.getByTestId('artifact-date-input').fill('2026-04-15');
  await page.getByTestId('artifact-file-input').setInputFiles({
    name: 'unsupported.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not-supported'),
  });
  await page.getByTestId('artifact-submit').click();

  await expect(page.getByTestId('upload-artifact-modal')).toBeVisible();
  await expect(page.getByTestId('artifact-file-error')).toContainText('File type not supported');
  await expect(page.getByTestId('artifact-title-input')).toHaveValue('Validation Failure Artifact');
  await expect(page.getByTestId('artifact-date-input')).toHaveValue('2026-04-15');
});
