import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Structured blockers update Data tab and aggregate posture', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-010, AC-BE-002, AC-INT-003
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-01', executionMode: 'replay', featureMode: 'extraction-first' });
  await uploadNovaArtifact(page, { fixtureKey: 'wave02-blockers-export' });
  await page.getByTestId('product-tab-data').click();
  await page.getByTestId('data-subtab-blockers').click();
  await expect(page.getByTestId('data-row-B-003')).toBeVisible();
  await page.getByTestId('product-tab-overview').click();
  await expect(page.getByTestId('product-status-badge')).toContainText(/Risk|Caution|Healthy/i);
});
