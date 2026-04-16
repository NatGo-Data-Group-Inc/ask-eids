import { test, expect } from '@playwright/test';
import { runDentalNovaLifecycle } from './helpers/novaLifecycle.js';

test('Dental lifecycle remains coherent across all waves', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-G-006, AC-G-007, AC-INT-007
  const uploads = await runDentalNovaLifecycle({ page, request, executionMode: 'replay' });
  await page.goto('/products/dental?tab=overview');
  await expect(page.getByTestId('product-status-badge')).toContainText(/Caution|Healthy|Risk/i);
  await page.getByTestId('product-tab-sources').click();
  await expect(page.getByTestId(`source-item-${uploads.wave03.sourceId}`)).toBeVisible();
  await page.getByTestId('product-tab-reports').click();
  await page.getByTestId('generate-report-button').click();
  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
});
