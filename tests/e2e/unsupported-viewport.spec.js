import { test, expect } from '@playwright/test';

test('unsupported viewport remains authoritative', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/products/dental?tab=overview');

  await expect(page.getByTestId('unsupported-viewport')).toBeVisible();
  await expect(page.getByTestId('upload-artifact-modal')).toHaveCount(0);
  await expect(page.getByTestId('product-page')).toHaveCount(0);
});
