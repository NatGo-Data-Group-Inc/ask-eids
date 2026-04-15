import { test, expect } from '@playwright/test';

test('unsupported viewport replaces interactive app content', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/portfolio');

  await expect(page.getByTestId('unsupported-viewport')).toBeVisible();
  await expect(page.getByTestId('portfolio-page')).toHaveCount(0);
});
