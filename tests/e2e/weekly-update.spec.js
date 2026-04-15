import { test, expect } from '@playwright/test';
import { longText, resetAppState } from './test-helpers.js';

test.beforeEach(async ({ request }) => {
  await resetAppState(request);
});

test('weekly update validates then publishes and refreshes overview signals', async ({ page }) => {
  await page.goto('/products/dental?tab=overview');
  await page.getByTestId('update-weekly-button').click();
  await expect(page.getByTestId('update-weekly-modal')).toBeVisible();

  await page.getByTestId('weekly-submit').click();
  await expect(page.getByText('Choose a week ending date')).toBeVisible();
  await expect(page.getByText('Enter a summary between 100 and 1500 characters')).toBeVisible();

  await page.getByTestId('weekly-week-ending-input').fill('2026-04-13');
  await page.getByTestId('weekly-summary-input').fill(longText('Sprint 2 continues with vendor coordination and evidence capture.'));
  await page.getByTestId('weekly-accomplishments-input').fill('Revised schedule approved, transcript evidence uploaded, and stakeholder alignment improved.');
  await page.getByTestId('weekly-risks-input').fill('Vendor delay remains the top concern, but mitigation is underway.');
  await page.getByTestId('weekly-next-steps-input').fill('Confirm vendor timeline, publish revised milestone dates, and prepare the next leadership review.');
  await page.getByTestId('weekly-submit').click();

  await expect(page.getByTestId('toast-success')).toContainText('Weekly update published');
  await expect(page.locator('.signals-list')).toContainText('Weekly update published');
});
