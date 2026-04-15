import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('tab routing updates URL and content without full reload', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-tab-overview')).toHaveAttribute('aria-selected', 'true');

  await page.evaluate(() => {
    window.__phase3NoReloadMarker = 'persist';
  });

  await page.getByTestId('product-tab-timeline').click();
  await expect(page.getByTestId('timeline-view')).toBeVisible();
  await expect(page).toHaveURL(/tab=timeline/);
  await expect(page.getByTestId('product-tab-timeline')).toHaveAttribute('aria-selected', 'true');
  await expect(page.evaluate(() => window.__phase3NoReloadMarker)).resolves.toBe('persist');
});

test('portfolio back link restores prior scroll position', async ({ page }) => {
  await page.goto('/portfolio');
  await page.evaluate(() => {
    document.body.style.minHeight = '3000px';
  });
  await page.getByTestId('product-card-dental').click();
  await expect(page.getByTestId('product-page')).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem('portfolioScrollY', '220');
  });

  await page.getByTestId('product-back-link').click();
  await expect(page.getByTestId('portfolio-page')).toBeVisible();

  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test('recent signal routes to timeline with matching filter', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  const firstSignal = page.locator('[data-testid^="recent-signal-"]').first();
  const signalType = await firstSignal.getAttribute('data-signal-type');
  const expectedFilter = ['decision', 'transcript', 'email', 'risk', 'ado', 'weekly', 'document', 'blocker'].includes(signalType || '')
    ? signalType
    : 'all';
  await firstSignal.click();
  await expect(page.getByTestId('timeline-view')).toBeVisible();
  await expect(page).toHaveURL(/tab=timeline/);
  await expect(page).toHaveURL(new RegExp(`timelineFilter=${expectedFilter}`));
  await expect(page.getByTestId(`timeline-filter-${expectedFilter}`)).toHaveClass(/active/);
});

test('forbidden and not found product routes render scoped error states', async ({ page }) => {
  await page.goto('/products/essence?tab=overview&asRole=read');
  await expect(page.getByTestId('product-forbidden-view')).toBeVisible();
  await expect(page.getByText('You don’t have access to this product.')).toBeVisible();

  await page.goto('/products/does-not-exist?tab=overview');
  await expect(page.getByTestId('product-not-found-view')).toBeVisible();
  await expect(page.getByText('This product doesn’t exist.')).toBeVisible();
});
