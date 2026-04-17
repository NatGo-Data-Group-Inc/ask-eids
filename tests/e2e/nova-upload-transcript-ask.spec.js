import { test, expect } from '@playwright/test';
import { askAndWait, resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental Ask cites extracted transcript evidence after upload', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-013, AC-BE-012, AC-INT-005
  await resetLifecycleState(request, {
    productId: 'dental',
    mode: 'wave-01',
    executionMode: 'replay',
    featureFlags: {
      enableNovaDentalLiveEmail: false,
      enableDentalTrustSurfaces: true,
      enableDentalSemanticServiceSplit: false,
      enableExtractionReplayMode: true,
      enableDentalRetrievalIndexing: true,
    },
  });
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave02-leadership-sync-transcript' });
  await askAndWait(page, `What does ${uploaded.title} say about the release-plan change?`);
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.locator('[data-testid^="ask-evidence-source-"]').filter({ hasText: uploaded.title }).first()).toBeVisible();
});
