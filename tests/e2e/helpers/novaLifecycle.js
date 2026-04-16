import fs from 'node:fs/promises';
import { expect } from '@playwright/test';
import { docPackPath } from '../test-helpers.js';

const FIXTURE_MAP = {
  'wave01-vendor-delay-email': {
    fileSegments: ['wave-01-operational', 'products', 'dental', 'emails', '2026-04-08-email-vendor-to-lowry-sandbox-delay.eml'],
  },
  'wave02-leadership-sync-transcript': {
    fileSegments: ['wave-02-escalation', 'products', 'dental', 'transcripts', '2026-04-12-dental-leadership-sync-transcript.docx'],
  },
  'wave02-blockers-export': {
    fileSegments: ['wave-02-escalation', 'products', 'dental', 'structured', '2026-04-13-dental-blockers-export.csv'],
  },
  'wave03-vendor-mitigation-email': {
    fileSegments: ['wave-03-recovery', 'products', 'dental', 'emails', '2026-04-16-email-lowry-to-jaden-vendor-mitigation-confirmed.eml'],
  },
  'forced-invalid-extraction-email': {
    fileSegments: ['wave-03-recovery', 'products', 'dental', 'emails', '2026-04-16-email-lowry-to-jaden-vendor-mitigation-confirmed.eml'],
  },
};

async function resolveFixtureDescriptor(fixtureKey) {
  const fixture = FIXTURE_MAP[fixtureKey];
  if (!fixture) {
    throw new Error(`Unknown fixture key: ${fixtureKey}`);
  }
  const filePath = docPackPath(...fixture.fileSegments);
  const metadataPath = `${filePath}.metadata.json`;
  const metadataJson = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  const metadataAttributes = metadataJson.metadataAttributes || {};
  return {
    filePath,
    metadataPath,
    title: metadataAttributes.title || fixtureKey,
    sourceType: metadataAttributes.source_type || 'document',
    sourceDate: metadataAttributes.document_date || '2026-04-15',
  };
}

export async function resetLifecycleState(request, {
  productId = 'dental',
  mode = 'wave-00',
  executionMode = 'replay',
  featureMode = 'extraction-first',
} = {}) {
  const response = await request.post('/api/v1/test/reset', {
    data: { productId, mode, executionMode, featureMode },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

export async function uploadNovaArtifact(page, {
  fixtureKey,
  testCase = '',
} = {}) {
  const descriptor = await resolveFixtureDescriptor(fixtureKey);
  const targetUrl = `/products/dental?tab=overview${testCase ? `&testCase=${encodeURIComponent(testCase)}` : ''}`;
  await page.goto(targetUrl);
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(descriptor.filePath);
  const sourceTypeSelect = page.getByTestId('artifact-source-type-select');
  if (await sourceTypeSelect.count()) {
    const currentValue = await sourceTypeSelect.inputValue();
    const disabled = await sourceTypeSelect.isDisabled();
    if (!disabled && currentValue !== descriptor.sourceType) {
      await sourceTypeSelect.selectOption(descriptor.sourceType);
    }
  }
  await page.getByTestId('artifact-date-input').fill(descriptor.sourceDate);
  await page.getByTestId('artifact-title-input').fill(descriptor.title);
  await page.getByTestId('artifact-metadata-file-input').setInputFiles(descriptor.metadataPath);
  const structuredConfirmation = page.getByTestId('structured-impact-confirmation');
  if (await structuredConfirmation.count()) {
    await structuredConfirmation.check();
  }

  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && response.url().includes('/api/v1/products/dental/sources')
  ));
  await page.getByTestId('artifact-submit').click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();

  if (testCase === 'forcedInvalidExtraction') {
    await expect(page.getByTestId('artifact-processing-error')).toBeVisible({ timeout: 20000 });
  } else {
    await expect(page.getByTestId('artifact-processing-complete')).toBeVisible({ timeout: 20000 });
  }

  return {
    ...descriptor,
    ...payload,
  };
}

export async function askAndWait(page, question) {
  await page.getByTestId('ask-input').fill(question);
  await page.getByTestId('ask-submit').click();
  await expect(page.getByTestId('ask-answer')).toBeVisible({ timeout: 20000 });
}

export async function runDentalNovaLifecycle({ page, request, executionMode = 'replay' }) {
  await resetLifecycleState(request, { productId: 'dental', mode: 'wave-00', executionMode, featureMode: 'extraction-first' });
  const wave01 = await uploadNovaArtifact(page, { fixtureKey: 'wave01-vendor-delay-email' });
  const wave02 = await uploadNovaArtifact(page, { fixtureKey: 'wave02-blockers-export' });
  const wave03 = await uploadNovaArtifact(page, { fixtureKey: 'wave03-vendor-mitigation-email' });
  return { wave01, wave02, wave03 };
}
