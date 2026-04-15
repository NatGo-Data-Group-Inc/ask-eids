import path from 'node:path';
import { expect } from '@playwright/test';

export async function resetAppState(request, options = {}) {
  const params = new URLSearchParams();
  if (options.corpusWave) {
    params.set('corpusWave', options.corpusWave);
  }
  const suffix = params.size ? `?${params.toString()}` : '';
  const response = await request.post(`/api/v1/test/reset${suffix}`);
  expect(response.ok()).toBeTruthy();
}

export function docPackPath(...segments) {
  return path.resolve('EIDS-Prototype-Document-Pack', ...segments);
}

export function fixturePath(...segments) {
  return path.resolve('tests', 'fixtures', ...segments);
}

export function longText(seed) {
  return `${seed} ${'This update is evidence-rich and intentionally long enough to satisfy the validation constraints. '.repeat(4)}`.trim();
}
