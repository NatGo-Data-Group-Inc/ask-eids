import { test, expect } from '@playwright/test';
import { resetAppState } from '../test-helpers.js';
import { loadDentalLifecycleArtifacts, uploadLifecycleArtifact, waitForArtifactToSurface } from './dental-pack-lifecycle.helpers.js';

test.describe('Dental Gold Pack lifecycle workflow', () => {
  test.setTimeout(480000);

  test.beforeEach(async ({ request }) => {
    await resetAppState(request, { corpusWave: 'wave-00-baseline' });
  });

  test('uploads Dental lifecycle artifacts in approved order and validates wave transitions', async ({ page }) => {
    const artifacts = await loadDentalLifecycleArtifacts();
    const wave01 = artifacts.filter((artifact) => artifact.wave === 'wave-01-operational');
    const wave02 = artifacts.filter((artifact) => artifact.wave === 'wave-02-escalation');
    const wave03 = artifacts.filter((artifact) => artifact.wave === 'wave-03-recovery');

    await test.step('Start from baseline seeded state', async () => {
      await page.goto('/portfolio');
      await expect(page.getByTestId('product-card-dental')).toContainText(/Caution|At Risk/);
      await page.getByTestId('product-card-dental').click();
      await expect(page.getByTestId('product-page')).toBeVisible();
      await expect(page.getByTestId('product-tab-overview')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'DENTAL / DENCLASS' })).toBeVisible();
    });

    await test.step('Upload wave 01 operational artifacts one by one', async () => {
      for (const artifact of wave01) {
        await test.step(`Upload ${artifact.title}`, async () => {
          const uploadPayload = await uploadLifecycleArtifact(page, artifact);
          await waitForArtifactToSurface(page, artifact, uploadPayload);
        });
      }
      await page.goto('/products/dental?tab=overview');
      await expect(page.locator('.product-status-badge')).toContainText('At Risk');
      await page.getByTestId('ask-input').fill('What decisions were made this sprint?');
      await page.getByTestId('ask-submit').click();
      await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 20000 });
    });

    await test.step('Upload wave 02 escalation artifacts one by one', async () => {
      for (const artifact of wave02) {
        await test.step(`Upload ${artifact.title}`, async () => {
          const uploadPayload = await uploadLifecycleArtifact(page, artifact);
          await waitForArtifactToSurface(page, artifact, uploadPayload);
        });
      }
      await page.goto('/products/dental?tab=data');
      await page.getByTestId('data-subtab-blockers').click();
      await expect(page.getByTestId('data-row-B-003')).toBeVisible();
      await page.goto('/products/dental?tab=reports');
      await page.getByTestId('generate-report-button').click();
      await expect(page.getByTestId('report-section-executive-summary')).toBeVisible({ timeout: 60000 });
    });

    await test.step('Upload wave 03 recovery artifacts one by one', async () => {
      for (const artifact of wave03) {
        await test.step(`Upload ${artifact.title}`, async () => {
          const uploadPayload = await uploadLifecycleArtifact(page, artifact);
          await waitForArtifactToSurface(page, artifact, uploadPayload);
        });
      }
      await page.goto('/products/dental?tab=overview');
      await expect(page.locator('.product-status-badge')).toContainText('Caution');
      await page.getByTestId('ask-input').fill('What evidence supports the recovery path?');
      await page.getByTestId('ask-submit').click();
      await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 20000 });
      await page.getByTestId('product-tab-sources').click();
      await expect(page.getByText(/Dental Leadership Readout Deck/)).toBeVisible();
    });
  });
});
