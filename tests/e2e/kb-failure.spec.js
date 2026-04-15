import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('ask failure renders scoped error without crashing the page', async ({ page }) => {
  await page.goto('/products/dental?tab=overview&testCase=kbFailure');
  await page.getByTestId('ask-input').fill('What decisions were made this sprint?');
  await page.getByTestId('ask-submit').click();

  await expect(page.getByTestId('ask-error-state')).toBeVisible();
  await expect(page.getByTestId('product-page')).toBeVisible();
});
