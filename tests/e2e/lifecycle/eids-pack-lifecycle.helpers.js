import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { docPackPath } from '../test-helpers.js';

const DEFAULT_PRODUCT_IDS = ['dental', 'essence', 'optima'];
const manifestPath = docPackPath('00-operator-guide', 'MASTER-MANIFEST.csv');

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  values.push(current);
  return values.map((value) => value.trim());
}

async function parseManifest() {
  const text = await fs.readFile(manifestPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function buildSyntheticContent(row, metadataAttributes) {
  const decisionLine = String(metadataAttributes.contains_decisions).toLowerCase() === 'true'
    ? `Decision: ${metadataAttributes.title} is treated as an explicit decision artifact for the lifecycle workflow.`
    : '';
  const actionLine = String(metadataAttributes.contains_action_items).toLowerCase() === 'true'
    ? `Action: Capture the next lifecycle update for ${metadataAttributes.product_name}.`
    : '';
  return [
    `Title: ${metadataAttributes.title}`,
    `Product: ${metadataAttributes.product_name}`,
    `Wave: ${metadataAttributes.wave_label}`,
    `Date: ${metadataAttributes.document_date}`,
    `Author: ${metadataAttributes.author}`,
    `Source Type: ${metadataAttributes.source_type}`,
    '',
    metadataAttributes.demo_effect || row.demo_effect || `${metadataAttributes.title} uploaded for lifecycle coverage.`,
    '',
    decisionLine,
    actionLine,
  ].filter(Boolean).join('\n');
}

function syntheticRelativePathForRow(row, metadataAttributes) {
  const sourceType = metadataAttributes.source_type || row.source_type || '';
  if (sourceType === 'transcript') {
    return row.relative_path.replace(/\.[^.]+$/i, '.md');
  }
  return row.relative_path;
}

async function writeTempFile(tempDir, relativePath, content) {
  const filePath = path.join(tempDir, relativePath.replaceAll('/', path.sep));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

function normalizeUploadSourceDate(sourceDate) {
  const trimmed = String(sourceDate || '').trim();
  if (!trimmed) {
    return trimmed;
  }
  const today = new Date();
  const todayLabel = [
    today.getUTCFullYear(),
    String(today.getUTCMonth() + 1).padStart(2, '0'),
    String(today.getUTCDate()).padStart(2, '0'),
  ].join('-');
  return trimmed > todayLabel ? todayLabel : trimmed;
}

export async function loadEidsLifecycleArtifacts({ productIds = DEFAULT_PRODUCT_IDS } = {}) {
  const allowedProductIds = new Set(productIds);
  const rows = await parseManifest();
  const liveRows = rows.filter((row) => allowedProductIds.has(row.product_id) && row.wave !== 'wave-00-baseline');
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'askeids-multi-lifecycle-'));

  const descriptors = [];
  for (const row of liveRows) {
    const absolutePath = docPackPath(...row.relative_path.split('/'));
    const metadataPath = `${absolutePath}.metadata.json`;
    const metadataJson = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    const metadataAttributes = metadataJson.metadataAttributes || {};
    const metadataWrapper = {
      ...metadataJson,
      corpusRelativePath: row.relative_path,
    };

    let filePath = absolutePath;
    try {
      await fs.access(filePath);
    } catch {
      filePath = await writeTempFile(
        tempDir,
        syntheticRelativePathForRow(row, metadataAttributes),
        buildSyntheticContent(row, metadataAttributes)
      );
    }

    const metadataFilePath = await writeTempFile(
      tempDir,
      `${row.relative_path}.metadata.json`,
      JSON.stringify(metadataWrapper, null, 2)
    );

    descriptors.push({
      ingestOrder: Number.parseInt(row.ingest_order, 10),
      productId: row.product_id,
      productName: row.product_name,
      wave: row.wave,
      waveLabel: row.wave_label,
      title: row.title,
      relativePath: row.relative_path,
      filePath,
      metadataFilePath,
      sourceType: metadataAttributes.source_type || row.source_type,
      sourceDate: metadataAttributes.document_date || row.document_date,
      uploadSourceDate: normalizeUploadSourceDate(metadataAttributes.document_date || row.document_date),
      expectedStatus: row.status_signal,
      format: row.format,
    });
  }

  return descriptors.sort((left, right) => left.ingestOrder - right.ingestOrder);
}

export async function uploadLifecycleArtifact(page, descriptor) {
  await page.goto(`/products/${descriptor.productId}?tab=overview`);
  await page.getByTestId('upload-artifact-button').click();
  await page.getByTestId('artifact-file-input').setInputFiles(descriptor.filePath);
  const sourceTypeSelect = page.getByTestId('artifact-source-type-select');
  if (await sourceTypeSelect.count()) {
    const value = await sourceTypeSelect.inputValue();
    if (descriptor.sourceType && value !== descriptor.sourceType) {
      await sourceTypeSelect.selectOption(descriptor.sourceType);
    }
  }
  await page.getByTestId('artifact-date-input').fill(descriptor.uploadSourceDate || descriptor.sourceDate);
  await page.getByTestId('artifact-title-input').fill(descriptor.title);
  await page.getByTestId('artifact-metadata-file-input').setInputFiles(descriptor.metadataFilePath);
  const structuredConfirm = page.getByTestId('structured-impact-confirmation');
  if (await structuredConfirm.count()) {
    await structuredConfirm.check();
  }
  const uploadResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && response.url().includes(`/api/v1/products/${descriptor.productId}/sources`)
  ));
  await page.getByTestId('artifact-submit').click();
  const uploadResponse = await uploadResponsePromise;
  if (!uploadResponse.ok()) {
    throw new Error(`Artifact upload request failed for "${descriptor.title}" (${descriptor.productId}) with status ${uploadResponse.status()}.`);
  }
  const uploadPayload = await uploadResponse.json();

  const modal = page.getByTestId('upload-artifact-modal');
  try {
    await modal.waitFor({ state: 'hidden', timeout: 15000 });
  } catch {
    const errorLocators = [
      page.getByTestId('artifact-inline-error'),
      page.getByTestId('artifact-file-error'),
      page.getByTestId('artifact-source-type-error'),
      page.getByTestId('artifact-date-error'),
    ];
    const visibleErrors = [];
    for (const locator of errorLocators) {
      if (await locator.count()) {
        const text = (await locator.first().textContent())?.trim();
        if (text) {
          visibleErrors.push(text);
        }
      }
    }
    throw new Error(`Upload modal did not close for "${descriptor.title}" (${descriptor.productId}). ${visibleErrors.join(' | ') || 'No scoped validation message was available.'}`);
  }

  return uploadPayload;
}

export async function waitForArtifactToSurface(page, descriptor, uploadPayload = {}) {
  await page.goto(`/products/${descriptor.productId}?tab=sources`);
  if (uploadPayload.sourceId) {
    await page.getByTestId(`source-item-${uploadPayload.sourceId}`).waitFor({ state: 'visible', timeout: 30000 });
    return;
  }
  await page
    .locator('[data-testid^="source-item-"]')
    .filter({ hasText: descriptor.title })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 });
}
