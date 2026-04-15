import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('keyboard navigation works for search, tabs, and filter chips', async ({ page }) => {
  await page.goto('/portfolio');

  await page.keyboard.press('/');
  await expect(page.getByTestId('topnav-search-input')).toBeFocused();
  await page.keyboard.type('den');
  await expect(page.getByTestId('search-palette')).toBeVisible();
  await expect(page.getByTestId('search-result-product-dental')).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/products\/dental/);
  await expect(page.getByTestId('product-page')).toBeVisible();

  await page.getByTestId('product-tab-overview').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('product-tab-timeline')).toBeFocused();
  await expect(page.getByTestId('timeline-view')).toBeVisible();

  const timelineFilters = page.locator('[data-testid^="timeline-filter-"]');
  await expect(timelineFilters.nth(1)).toBeVisible();
  await page.getByTestId('timeline-filter-all').focus();
  await page.keyboard.press('ArrowRight');
  await expect(timelineFilters.nth(1)).toBeFocused();
  await expect(timelineFilters.nth(1)).toHaveClass(/active/);

  await page.getByTestId('product-tab-sources').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sources-view')).toBeVisible();
  await page.getByTestId('source-filter-all').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('source-filter-transcript')).toBeFocused();
  await expect(page.getByTestId('source-filter-transcript')).toHaveClass(/active/);
});

test('reduced motion disables non-essential animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/portfolio');
  const animationInfo = await page.locator('.pcard').first().evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      animationName: style.animationName,
      transitionDuration: style.transitionDuration,
    };
  });

  expect(animationInfo.animationName).toBe('none');
  expect(['0s', '0ms']).toContain(animationInfo.transitionDuration);
});
