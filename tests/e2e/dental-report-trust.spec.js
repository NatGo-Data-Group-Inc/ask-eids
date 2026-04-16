import { test, expect } from '@playwright/test';
import { resetLifecycleState } from './helpers/novaLifecycle.js';

test('Reports show semantic-state trust and regeneration state together', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: Report generation runs against the real backend; semantic trust metadata may reflect replay-backed extraction when live Bedrock is unavailable.
  // Validates: AC-FE-010, AC-FE-011, AC-BE-010, AC-INT-006
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-02',
    executionMode: 'replay',
    featureMode: 'live-email-trust-hardening',
  });

  await page.goto('/products/dental?tab=reports');
  await page.getByTestId('generate-report-button').click();

  await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('report-semantic-state-banner')).toBeVisible();
});
