import { test, expect } from '@playwright/test';
import { resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('portfolio to product happy path', async ({ page }) => {
  await page.goto('/portfolio');
  await expect(page.getByTestId('portfolio-page')).toBeVisible();
  await expect(page.getByTestId('pulse-bar')).toBeVisible();
  await expect(page.getByTestId('alerts-bar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Needs Attention' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On Track' })).toBeVisible();

  const headerOrder = await page.evaluate(() => Array.from(document.querySelectorAll('h2')).map((node) => node.textContent));
  expect(headerOrder.findIndex((text) => text === 'Needs Attention')).toBeLessThan(headerOrder.findIndex((text) => text === 'On Track'));

  const dentalCard = page.getByTestId('product-card-dental');
  await expect(dentalCard).toContainText('DENTAL');
  await expect(dentalCard).toContainText(/At Risk|Caution|On Track/);
  await expect(dentalCard).toContainText('Risks:');
  await expect(dentalCard).toContainText('Blockers:');
  await expect(dentalCard).toContainText('PI');
  await expect(dentalCard).toContainText('Sprint');
  await expect(dentalCard).toContainText('PM:');

  await page.getByTestId('product-card-dental').click();

  await expect(page).toHaveURL(/\/products\/dental\?tab=overview/);
  await expect(page.getByTestId('product-page')).toBeVisible();
  await expect(page.getByTestId('product-tab-overview')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('knowledge-health-panel')).toBeVisible();
});
