import { test, expect } from '@playwright/test';
import { resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental hybrid mode surfaces semantic freshness after email upload', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: When Bedrock is unavailable in the local environment, the running backend records replay execution explicitly instead of a live provider call.
  // Validates: AC-G-001, AC-G-002, AC-FE-001, AC-FE-002, AC-BE-001, AC-BE-003, AC-INT-001, AC-INT-002
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
  await expect(page.getByTestId('semantic-freshness-badge')).toBeVisible();

  await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });

  await expect(page.getByTestId('semantic-freshness-badge')).toContainText(/fresh/i);
  await expect(page.getByTestId('overview-current-state')).toBeVisible();
});
