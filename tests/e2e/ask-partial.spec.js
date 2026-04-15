import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('ask shows answer and partial evidence warning', async ({ page }) => {
  await page.goto('/products/essence?tab=overview');
  await page.getByTestId('ask-input').fill('What decisions were made recently?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-gap-warning')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toBeVisible();
});
