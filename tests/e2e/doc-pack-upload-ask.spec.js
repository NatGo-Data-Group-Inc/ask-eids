import { test, expect } from '@playwright/test';
import { docPackPath, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('uploads a real document-pack transcript and answers from it', async ({ page }) => {
  const transcriptPath = docPackPath(
    'wave-03-recovery',
    'products',
    'dental',
    'transcripts',
    '2026-04-15-dental-vendor-recovery-call-transcript.md'
  );
  const meetingTitle = `Dental Vendor Recovery Call PW ${Date.now()}`;

  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-page')).toBeVisible();

  await page.getByTestId('upload-transcript-button').click();
  await expect(page.getByTestId('upload-transcript-modal')).toBeVisible();
  await page.getByTestId('transcript-title-input').fill(meetingTitle);
  await page.getByTestId('transcript-date-input').fill('2026-04-15');
  await page.getByTestId('transcript-file-input').setInputFiles(transcriptPath);
  await page.getByTestId('transcript-notes-input').fill('Wave 03 recovery evidence from the prototype document pack.');
  await page.getByTestId('transcript-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Transcript uploaded');
  await page.waitForTimeout(1000);

  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId('sources-view')).toBeVisible();
  await expect(page.getByText(meetingTitle)).toBeVisible({ timeout: 15000 });

  await page.getByTestId('product-tab-overview').click();
  await page.getByTestId('ask-input').fill('What changed in the vendor recovery call?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-answer')).toContainText('Evidence-backed response');
  await expect(page.getByTestId('ask-answer')).toContainText(meetingTitle);
});
