import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('search palette opens and keyboard navigation opens a result', async ({ page }) => {
  await page.goto('/portfolio');
  await expect(page.getByTestId('topnav-brand')).toBeVisible();
  await expect(page.getByTestId('topnav-search-input')).toBeVisible();
  await page.getByTestId('topnav-search-input').fill('den');

  await expect(page.getByTestId('search-palette')).toBeVisible();
  await expect(page.getByTestId('search-result-product-dental')).toBeVisible();

  await page.getByTestId('topnav-search-input').press('ArrowDown');
  await page.getByTestId('topnav-search-input').press('Enter');

  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/dental/);
});

test('search shows no-results message when nothing matches', async ({ page }) => {
  await page.goto('/portfolio');
  await page.getByTestId('topnav-search-input').fill('zzzz-no-match');
  await expect(page.getByTestId('search-palette')).toBeVisible();
  await expect(page.getByText('No matching products or sources')).toBeVisible();
});
