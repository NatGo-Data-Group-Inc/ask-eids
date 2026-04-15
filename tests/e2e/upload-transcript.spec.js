import { test, expect } from '@playwright/test';
import { docPackPath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('upload transcript queues ingest and later surfaces evidence', async ({ page }) => {
  const transcriptPath = docPackPath(
    'wave-01-operational',
    'products',
    'dental',
    'transcripts',
    '2026-04-09-dental-sprint2-review-transcript.docx'
  );
  const meetingTitle = `Sprint 2 Review Upload ${Date.now()}`;

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('upload-transcript-button')).toBeVisible();
  await page.getByTestId('upload-transcript-button').click();
  await expect(page.getByTestId('upload-transcript-modal')).toBeVisible();
  await page.getByTestId('transcript-title-input').fill(meetingTitle);
  await page.getByTestId('transcript-date-input').fill('2026-04-09');
  await page.getByTestId('transcript-file-input').setInputFiles(transcriptPath);
  await page.getByTestId('transcript-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Transcript uploaded');
  await expect(page.getByTestId('ingest-pending-state')).toBeVisible();
  await page.waitForTimeout(1000);
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByText(meetingTitle)).toBeVisible({ timeout: 15000 });
});
