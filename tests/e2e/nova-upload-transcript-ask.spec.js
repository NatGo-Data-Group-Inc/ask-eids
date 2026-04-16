import { test, expect } from '@playwright/test';
import { askAndWait, resetLifecycleState, uploadNovaArtifact } from './helpers/novaLifecycle.js';

test('Dental Ask cites extracted transcript evidence after upload', async ({ page, request }) => {
  // Proof Type: Live Backend-Backed E2E (replay-backed model outputs)
  // Validates: AC-FE-013, AC-BE-012, AC-INT-005
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-01', executionMode: 'replay', featureMode: 'extraction-first' });
  const uploaded = await uploadNovaArtifact(page, { fixtureKey: 'wave02-leadership-sync-transcript' });
  await askAndWait(page, 'What decisions are driving the release-plan change?');
  await expect(page.getByTestId('ask-answer')).toBeVisible();
  await expect(page.getByTestId('ask-evidence-source-0')).toContainText(uploaded.title);
});
