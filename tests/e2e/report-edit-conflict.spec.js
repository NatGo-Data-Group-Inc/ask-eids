import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('stale report section save shows recoverable conflict feedback', async ({ page, request }) => {
  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });

  const reportUrl = new URL(page.url());
  const reportId = reportUrl.searchParams.get('reportId');
  expect(reportId).toBeTruthy();

  const reportResponse = await request.get(`/api/v1/products/dental/reports/${reportId}`);
  expect(reportResponse.ok()).toBeTruthy();
  const reportBody = await reportResponse.json();
  const section = reportBody.sections.find((candidate) => candidate.sectionId === 'executive-summary');
  expect(section).toBeTruthy();

  await page.getByTestId('report-edit-executive-summary').click();
  await page.getByTestId('report-edit-textarea-executive-summary').fill('Stale save from browser editor');

  const serverUpdate = await request.patch(`/api/v1/products/dental/reports/${reportId}/sections/executive-summary`, {
    data: {
      body: 'Server-side update to create a stale client revision',
      expectedRevision: section.revision,
    },
  });
  expect(serverUpdate.status()).toBe(200);

  await page.getByTestId('report-save-executive-summary').click();
  await expect(page.getByTestId('toast-success')).toContainText('updated elsewhere');
  await expect(page.getByTestId('report-edit-textarea-executive-summary')).toBeVisible();
});
