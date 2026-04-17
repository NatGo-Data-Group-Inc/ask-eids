#!/usr/bin/env node
// Runs the Phase-1 per-doc extraction prompt across all text-format non-baseline
// manifest rows and writes per-product aggregate fixtures to
// scripts/prompt-eval/aggregate-fixtures/.
//
// Cache: each individual per-doc extraction is cached under scripts/prompt-eval/dump-cache/
// by its ingest_order so re-running is cheap (no duplicate Bedrock calls).
//
// Skipped formats: .pdf, .pptx (no normalizer in current repo; deferred to Phase 3).
// Handled formats: .eml, .md, .csv, .docx (mammoth).
//
// Usage:
//   EIDS_ENABLE_BEDROCK=true EIDS_AWS_REGION=us-east-1 AWS_PROFILE=default \
//     node scripts/prompt-eval/dump-sourceExtractions.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const ANSI = {
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  cyan: (s) => `\u001b[36m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
};

const SKIP_EXTENSIONS = new Set(['.pdf', '.pptx', '.xlsx']);
const PRODUCT_NAMES = { dental: 'DENTAL / DENCLASS', essence: 'ESSENCE Transition Support', optima: 'OPTIMA Care Coordination' };

function ensureEnv() {
  const errs = [];
  if (process.env.VITEST) errs.push('VITEST is set; bedrockTextAvailable() will return false.');
  if (process.env.NODE_ENV === 'test') errs.push('NODE_ENV=test disables Bedrock.');
  if (process.env.EIDS_ENABLE_BEDROCK !== 'true') errs.push('EIDS_ENABLE_BEDROCK must be "true"');
  if (!process.env.EIDS_AWS_REGION && !process.env.AWS_REGION) errs.push('EIDS_AWS_REGION or AWS_REGION must be set');
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) errs.push('AWS credentials missing');
  if (errs.length) {
    for (const e of errs) console.error(ANSI.red(`  - ${e}`));
    process.exit(3);
  }
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; }
      else { inQuotes = !inQuotes; }
      continue;
    }
    if (char === ',' && !inQuotes) { values.push(current); current = ''; continue; }
    current += char;
  }
  values.push(current);
  return values.map((v) => v.trim());
}

async function parseManifest() {
  const manifestPath = path.join(repoRoot, 'EIDS-Prototype-Document-Pack', '00-operator-guide', 'MASTER-MANIFEST.csv');
  const text = await fs.readFile(manifestPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  ensureEnv();

  const cacheDir = path.join(__dirname, 'dump-cache');
  const fixtureDir = path.join(__dirname, 'aggregate-fixtures');
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(fixtureDir, { recursive: true });

  const rows = await parseManifest();
  const nonBaseline = rows.filter((r) => r.wave !== 'wave-00-baseline').sort((a, b) => Number(a.ingest_order) - Number(b.ingest_order));

  console.log(ANSI.bold(`Processing ${nonBaseline.length} non-baseline manifest rows.`));

  const { normalizeSourceArtifact } = await import('../../server/src/services/semantic/sourceNormalization.service.js');
  const { generateBedrockText } = await import('../../server/src/lib/aws/bedrockText.js');
  const {
    EXTRACTION_SYSTEM_PROMPT,
    buildExtractionUserPrompt,
    parseModelJson,
    normalizeModelExtractionPayload,
  } = await import('../../server/src/services/semantic/novaSourceExtraction.service.js');
  const { validateSourceExtraction } = await import('../../server/src/services/semantic/extractionValidation.service.js');
  const { getRuntimeConfig } = await import('../../server/src/config/runtime.js');
  const runtimeConfig = getRuntimeConfig();

  const perDocResults = [];
  let cacheHits = 0;
  let liveCalls = 0;
  let skipped = 0;

  for (const row of nonBaseline) {
    const order = Number(row.ingest_order);
    const ext = path.extname(row.relative_path).toLowerCase();
    const cacheFile = path.join(cacheDir, `ingest-${order}.json`);

    if (SKIP_EXTENSIONS.has(ext)) {
      console.log(ANSI.yellow(`skip #${order} ${row.product_id}/${row.source_type} (${ext}): no normalizer available`));
      skipped += 1;
      continue;
    }

    if (await fileExists(cacheFile)) {
      const cached = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
      perDocResults.push(cached);
      cacheHits += 1;
      console.log(ANSI.dim(`cache #${order} ${row.product_id}/${row.source_type} (${cached.payload?.confidence})`));
      continue;
    }

    const docPath = path.join(repoRoot, 'EIDS-Prototype-Document-Pack', ...row.relative_path.split('/'));
    if (!(await fileExists(docPath))) {
      console.log(ANSI.yellow(`miss #${order}: file not on disk (${row.relative_path})`));
      skipped += 1;
      continue;
    }

    const buffer = await fs.readFile(docPath);
    const metaPath = `${docPath}.metadata.json`;
    let sidecar = null;
    if (await fileExists(metaPath)) {
      sidecar = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    }

    let normalized;
    try {
      normalized = await normalizeSourceArtifact({
        file: { buffer, originalname: path.basename(row.relative_path) },
        sourceType: row.source_type,
        sourceId: `ingest-${order}`,
        productId: row.product_id,
        title: row.title,
        sourceDate: row.document_date,
      });
    } catch (error) {
      console.log(ANSI.red(`fail  #${order} normalize: ${error.message}`));
      skipped += 1;
      continue;
    }

    const executionDecision = { promptVersion: 'phase2-dump-v1', executionMode: 'live', sourceFamily: normalized.sourceFamily };

    let rawText;
    try {
      rawText = await generateBedrockText({
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        promptText: buildExtractionUserPrompt(normalized, executionDecision),
        modelId: runtimeConfig?.bedrock?.textModelId || null,
        maxTokens: 900,
        temperature: 0,
      });
      liveCalls += 1;
    } catch (error) {
      console.log(ANSI.red(`fail  #${order} bedrock: ${error.message}`));
      skipped += 1;
      continue;
    }

    if (!rawText) {
      console.log(ANSI.red(`fail  #${order}: empty Bedrock response`));
      skipped += 1;
      continue;
    }

    let parsed;
    let validated;
    try {
      parsed = parseModelJson(rawText);
      const normalizedPayload = normalizeModelExtractionPayload(parsed);
      validated = validateSourceExtraction({ payload: normalizedPayload });
    } catch (error) {
      console.log(ANSI.red(`fail  #${order} validate: ${error.message}`));
      skipped += 1;
      continue;
    }

    const record = {
      sourceId: `ingest-${order}`,
      productId: row.product_id,
      productName: row.product_name,
      sourceType: row.source_type,
      sourceFamily: normalized.sourceFamily,
      wave: row.wave,
      ingestOrder: order,
      documentDate: row.document_date,
      title: row.title,
      author: row.author,
      metadata: sidecar?.metadataAttributes || null,
      payload: validated,
      promptVersion: executionDecision.promptVersion,
      modelId: runtimeConfig?.bedrock?.textModelId || 'amazon.nova-pro-v1:0',
      recordedAt: new Date().toISOString(),
    };
    await fs.writeFile(cacheFile, JSON.stringify(record, null, 2), 'utf8');
    perDocResults.push(record);
    const decisionCount = Array.isArray(validated.decisions) ? validated.decisions.length : 0;
    console.log(ANSI.green(`ok    #${order} ${row.product_id}/${row.source_type} decisions=${decisionCount} conf=${validated.confidence}`));
  }

  console.log('');
  console.log(ANSI.bold(`Per-doc summary: ${perDocResults.length} ok, ${cacheHits} cache hits, ${liveCalls} live calls, ${skipped} skipped.`));

  // Build fixture files per (product, cumulative wave cutoff).
  const fixtureSpecs = [
    { name: 'aggregate-dental-post-wave01', productId: 'dental', waveCutoffs: ['wave-01-operational'] },
    { name: 'aggregate-dental-post-wave03', productId: 'dental', waveCutoffs: ['wave-01-operational', 'wave-02-escalation', 'wave-03-recovery'] },
    { name: 'aggregate-essence-post-wave02', productId: 'essence', waveCutoffs: ['wave-02-escalation'] },
    { name: 'aggregate-optima-post-wave03', productId: 'optima', waveCutoffs: ['wave-01-operational', 'wave-03-recovery'] },
  ];

  for (const spec of fixtureSpecs) {
    const extractions = perDocResults
      .filter((r) => r.productId === spec.productId && spec.waveCutoffs.includes(r.wave))
      .sort((a, b) => b.ingestOrder - a.ingestOrder);
    const fixture = {
      _meta: {
        generatedAt: new Date().toISOString(),
        productId: spec.productId,
        productName: PRODUCT_NAMES[spec.productId],
        waveCutoffs: spec.waveCutoffs,
        extractionCount: extractions.length,
      },
      productId: spec.productId,
      productName: PRODUCT_NAMES[spec.productId],
      productMission: '',
      extractions,
    };
    const outPath = path.join(fixtureDir, `${spec.name}.json`);
    await fs.writeFile(outPath, JSON.stringify(fixture, null, 2), 'utf8');
    console.log(ANSI.cyan(`fixture ${path.relative(repoRoot, outPath)}: ${extractions.length} extractions`));
  }
}

main().catch((error) => {
  console.error(ANSI.red(`\nFatal: ${error?.stack || error?.message || error}`));
  process.exit(1);
});
