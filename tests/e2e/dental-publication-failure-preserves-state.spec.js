import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Publication failure preserves last-known-good semantic state', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: Publication failure is injected through the supported harness query path while still exercising the running backend and persisted state.
  // Validates: AC-G-005, AC-FE-013, AC-BE-008, AC-BE-009, AC-INT-003
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await page.goto('/products/dental?tab=overview');
  const priorStatus = await page.getByTestId('product-status-badge').textContent();

  await uploadNovaArtifact(page, {
    fixtureKey: 'wave03-vendor-mitigation-email',
    testCase: 'publicationFailure',
  });

  await expect(page.getByTestId('semantic-degraded-banner')).toBeVisible();
  await expect(page.getByTestId('product-status-badge')).toContainText(priorStatus || '');
});
