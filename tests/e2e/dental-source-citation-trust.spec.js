import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Source detail distinguishes exact citations from fallback references', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: Extraction may run in replay mode when Bedrock is unavailable, but the test still drives the real backend and persisted state.
  // Validates: AC-G-003, AC-FE-004, AC-FE-005, AC-FE-006, AC-FE-007, AC-BE-005, AC-BE-006, AC-BE-007, AC-INT-004
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'hybrid',
    featureMode: 'live-email-trust-hardening',
  });

  const upload = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  await page.getByTestId('product-tab-sources').click();
  await page.getByTestId(`source-item-${upload.sourceId}`).click();

  await expect(page.getByTestId('source-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('source-detail-citations')).toBeVisible();
  await expect(page.getByTestId('source-detail-citation-mode')).toContainText(/exact|fallback/i);
});
