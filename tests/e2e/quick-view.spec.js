import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('quick view drawer opens and routes into the product', async ({ page }) => {
  await page.goto('/portfolio');
  await page.getByTestId('quick-view-risks').click();

  await expect(page.getByTestId('quick-view-drawer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All Risks' })).toBeVisible();

  await page.getByTestId('quick-view-item-R-014').click();
  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page).toHaveURL(/\/products\/dental/);
});
