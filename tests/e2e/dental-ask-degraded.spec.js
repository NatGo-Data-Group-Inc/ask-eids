import { test, expect } from '@playwright/test';
import { askAndWait, resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Ask shows degraded semantic state when last-known-good aggregate is active', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E
  // Fallback Reason: Publication failure is injected through the supported running-backend harness path to prove last-known-good behavior without mocking primary API routes.
  // Validates: AC-G-004, AC-FE-008, AC-FE-009, AC-BE-009, AC-BE-010, AC-INT-003, AC-INT-005
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-00',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableSemanticServicePath: true,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });

  await uploadNovaArtifact(page, {
    fixtureKey: 'wave03-vendor-mitigation-email',
    testCase: 'publicationFailure',
  });

  await askAndWait(page, 'What is blocking recovery right now?');

  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-degraded-banner')).toBeVisible();
});
