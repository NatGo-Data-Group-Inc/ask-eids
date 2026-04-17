#!/usr/bin/env node
// Per-doc Nova Pro extraction prompt-iteration harness (Phase 1).
// See scripts/prompt-eval/README.md for usage and env vars.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const EXIT_OK = 0;
const EXIT_SCHEMA_FAIL = 1;
const EXIT_CONTENT_FAIL = 2;
const EXIT_ENV_FAIL = 3;
const EXIT_BEDROCK_FAIL = 4;

const ANSI = {
  red: (s) => `\u001b[31m${s}\u001b[0m`,
  green: (s) => `\u001b[32m${s}\u001b[0m`,
  yellow: (s) => `\u001b[33m${s}\u001b[0m`,
  cyan: (s) => `\u001b[36m${s}\u001b[0m`,
  dim: (s) => `\u001b[2m${s}\u001b[0m`,
  bold: (s) => `\u001b[1m${s}\u001b[0m`,
};

function fail(code, message) {
  console.error(ANSI.red(`\u2717 ${message}`));
  process.exit(code);
}

function check(label, predicate, evidence = '') {
  if (predicate) {
    console.log(`  ${ANSI.green('\u2713')} ${label}${evidence ? ANSI.dim(` \u2014 ${evidence}`) : ''}`);
    return true;
  }
  console.log(`  ${ANSI.red('\u2717')} ${label}${evidence ? ANSI.dim(` \u2014 ${evidence}`) : ''}`);
  return false;
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function persistRun({ ingestId, promptVersion, runtimeConfig, rawText, parsed, extraction, passed, schemaErrors = null, error = null }) {
  const stamp = new Date().toISOString().replaceAll(':', '').replace(/\..*/, '').replace('T', '-');
  const runDir = path.join(__dirname, 'runs');
  await fs.mkdir(runDir, { recursive: true });
  const runFile = path.join(runDir, `${ingestId}-${stamp}.json`);
  await fs.writeFile(runFile, JSON.stringify({
    ingestId,
    promptVersion,
    region: runtimeConfig?.aws?.region,
    modelId: runtimeConfig?.bedrock?.textModelId,
    timestamp: new Date().toISOString(),
    rawText,
    parsed,
    extraction,
    schemaErrors,
    error,
    passed,
  }, null, 2), 'utf8');
  console.log(ANSI.dim(`\nrun persisted: ${path.relative(repoRoot, runFile)}`));
}

function ensureEnv() {
  const errs = [];
  if (process.env.VITEST) errs.push('VITEST is set; bedrockTextAvailable() will return false.');
  if (process.env.NODE_ENV === 'test') errs.push('NODE_ENV=test will disable Bedrock.');
  if (process.env.EIDS_ENABLE_BEDROCK !== 'true') {
    errs.push('EIDS_ENABLE_BEDROCK must be "true". Current: ' + (process.env.EIDS_ENABLE_BEDROCK || '<unset>'));
  }
  const region = process.env.EIDS_AWS_REGION || process.env.AWS_REGION;
  if (!region) errs.push('EIDS_AWS_REGION (or AWS_REGION) must be set, e.g. us-east-1.');
  if (region && region.startsWith('us-gov-')) {
    console.log(ANSI.yellow(`! Note: region ${region} is GovCloud. Phase 1 plan calls for commercial. Continuing anyway.`));
  }
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) {
    errs.push('No AWS_ACCESS_KEY_ID and no AWS_PROFILE — SDK will have no creds.');
  }
  if (errs.length) {
    console.error(ANSI.red('Environment problems:'));
    for (const e of errs) console.error(`  - ${e}`);
    console.error('\nSee scripts/prompt-eval/README.md');
    process.exit(EXIT_ENV_FAIL);
  }
}

async function loadInputs(ingestId, expectedDoc) {
  const meta = expectedDoc._meta || {};
  if (!meta.manifestPath) {
    fail(EXIT_ENV_FAIL, `expected/${ingestId}.json is missing _meta.manifestPath`);
  }
  const docAbsPath = path.join(repoRoot, 'EIDS-Prototype-Document-Pack', ...meta.manifestPath.split('/').slice(1));
  const docFullPath = path.isAbsolute(meta.manifestPath)
    ? meta.manifestPath
    : path.join(repoRoot, meta.manifestPath);
  const buffer = await fs.readFile(docFullPath);
  const sidecar = await fs.readFile(`${docFullPath}.metadata.json`, 'utf8').then(JSON.parse).catch(() => null);
  return { buffer, sidecar, docFullPath };
}

function runAssertions(extraction, assertions) {
  const results = [];
  results.push(check('schema validation passed (delegated to validateSourceExtraction)', true));

  const decisions = Array.isArray(extraction.decisions) ? extraction.decisions : [];
  const dec = assertions.decisions || {};
  if (typeof dec.minCount === 'number') {
    results.push(check(`decisions.length >= ${dec.minCount}`, decisions.length >= dec.minCount, `got ${decisions.length}`));
  }
  if (typeof dec.maxCount === 'number') {
    results.push(check(`decisions.length <= ${dec.maxCount}`, decisions.length <= dec.maxCount, `got ${decisions.length}`));
  }
  if (dec.labelPattern) {
    const re = new RegExp(dec.labelPattern, 'i');
    const labels = decisions.map((d) => String(d?.label || ''));
    const hit = labels.find((l) => re.test(l));
    results.push(check(`some decision.label matches /${dec.labelPattern}/i`, Boolean(hit), hit ? `"${hit}"` : `labels=${JSON.stringify(labels)}`));
  }
  if (Array.isArray(dec.anchorTextSubstrings)) {
    for (const needle of dec.anchorTextSubstrings) {
      const re = new RegExp(needle, 'i');
      const anchors = decisions.map((d) => String(d?.anchorText || ''));
      const hit = anchors.find((a) => re.test(a));
      results.push(check(`some decision.anchorText matches /${needle}/i`, Boolean(hit), hit ? `"${hit}"` : ''));
    }
  }
  if (Array.isArray(dec.confidenceEnum) && dec.confidenceEnum.length) {
    const hit = decisions.find((d) => dec.confidenceEnum.includes(d?.confidence));
    results.push(check(`some decision.confidence in [${dec.confidenceEnum.join(',')}]`, Boolean(hit), hit ? `"${hit.confidence}"` : `got ${JSON.stringify(decisions.map((d) => d?.confidence))}`));
  }

  const warnings = Array.isArray(extraction.warnings) ? extraction.warnings : [];
  const warn = assertions.warnings || {};
  if (typeof warn.minCount === 'number') {
    results.push(check(`warnings.length >= ${warn.minCount}`, warnings.length >= warn.minCount, `got ${warnings.length}`));
  }
  if (warn.matchPattern) {
    const re = new RegExp(warn.matchPattern, 'i');
    const hit = warnings.find((w) => re.test(String(w || '')));
    results.push(check(`some warnings entry matches /${warn.matchPattern}/i`, Boolean(hit), hit ? `"${hit}"` : `got ${JSON.stringify(warnings)}`));
  }

  const summary = String(extraction.summary || '');
  const sa = assertions.summary || {};
  if (typeof sa.minLength === 'number') {
    results.push(check(`summary.length >= ${sa.minLength}`, summary.length >= sa.minLength, `got ${summary.length}`));
  }
  if (Array.isArray(sa.substringPatterns)) {
    for (const pattern of sa.substringPatterns) {
      const re = new RegExp(pattern, 'i');
      results.push(check(`summary matches /${pattern}/i`, re.test(summary), summary.slice(0, 80) + (summary.length > 80 ? '\u2026' : '')));
    }
  }

  if (Array.isArray(assertions.topLevelConfidence) && assertions.topLevelConfidence.length) {
    results.push(check(
      `top-level confidence in [${assertions.topLevelConfidence.join(',')}]`,
      assertions.topLevelConfidence.includes(extraction.confidence),
      `got "${extraction.confidence}"`,
    ));
  }

  return results.every(Boolean);
}

async function main() {
  const ingestId = process.argv[2];
  if (!ingestId) fail(EXIT_ENV_FAIL, 'Usage: node scripts/prompt-eval/run.mjs <ingest-id>  (e.g. ingest-28)');

  const expectedPath = path.join(__dirname, 'expected', `${ingestId}.json`);
  let expectedDoc;
  try {
    expectedDoc = await readJson(expectedPath);
  } catch (error) {
    fail(EXIT_ENV_FAIL, `Cannot read ${expectedPath}: ${error.message}`);
  }

  ensureEnv();

  console.log(ANSI.bold(`\n=== prompt-eval :: ${ingestId} ===`));
  console.log(ANSI.dim(`document: ${expectedDoc._meta?.manifestPath}`));
  console.log(ANSI.dim(`region:   ${process.env.EIDS_AWS_REGION || process.env.AWS_REGION}`));
  console.log(ANSI.dim(`model:    ${process.env.BEDROCK_TEXT_MODEL_ID || process.env.BEDROCK_GEN_MODEL_ID || 'amazon.nova-pro-v1:0 (default)'}`));

  // Lazy-import after env validation so getRuntimeConfig() reads our env.
  const { normalizeSourceArtifact } = await import('../../server/src/services/semantic/sourceNormalization.service.js');
  const { getRuntimeConfig } = await import('../../server/src/config/runtime.js');

  const runtimeConfig = getRuntimeConfig();
  const meta = expectedDoc._meta || {};
  const { buffer } = await loadInputs(ingestId, expectedDoc);
  const promptVersion = process.env.PROMPT_EVAL_VERSION || 'eval-1';

  console.log(ANSI.dim(`prompt:   ${promptVersion}`));
  console.log(ANSI.dim(`source:   ${meta.sourceType} / ${meta.sourceFamily}`));

  let normalized;
  try {
    normalized = await normalizeSourceArtifact({
      file: { buffer, originalname: path.basename(meta.manifestPath) },
      sourceType: meta.sourceType,
      sourceId: `eval-${ingestId}`,
      productId: meta.productId,
      title: meta.title,
      sourceDate: meta.documentDate,
    });
  } catch (error) {
    fail(EXIT_BEDROCK_FAIL, `normalizeSourceArtifact failed: ${error.message}`);
  }

  console.log(ANSI.dim(`normalizedText: ${normalized.normalizedText.length} chars, ${normalized.lineCount} lines`));

  // Reuse production prompt strings + Bedrock helpers so harness and prod cannot drift.
  const { generateBedrockText } = await import('../../server/src/lib/aws/bedrockText.js');
  const {
    EXTRACTION_SYSTEM_PROMPT,
    buildExtractionUserPrompt,
    parseModelJson,
    normalizeModelExtractionPayload,
  } = await import('../../server/src/services/semantic/novaSourceExtraction.service.js');
  const { validateSourceExtraction } = await import('../../server/src/services/semantic/extractionValidation.service.js');

  const executionDecision = { promptVersion, executionMode: 'live', sourceFamily: meta.sourceFamily || normalized.sourceFamily };

  let rawText = null;
  let parsed = null;
  let extraction = null;
  let schemaErrors = null;
  let bedrockErr = null;
  try {
    rawText = await generateBedrockText({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      promptText: buildExtractionUserPrompt(normalized, executionDecision),
      modelId: runtimeConfig?.bedrock?.textModelId || null,
      maxTokens: 900,
      temperature: 0,
    });
  } catch (error) {
    bedrockErr = error;
  }

  if (bedrockErr) {
    persistRun({ ingestId, promptVersion, runtimeConfig, rawText: null, parsed: null, extraction: null, passed: false, error: String(bedrockErr.stack || bedrockErr.message) });
    fail(EXIT_BEDROCK_FAIL, `Bedrock call failed: ${bedrockErr.message}`);
  }
  if (!rawText) {
    persistRun({ ingestId, promptVersion, runtimeConfig, rawText: null, parsed: null, extraction: null, passed: false });
    fail(EXIT_BEDROCK_FAIL, 'Bedrock returned empty response (check creds + EIDS_ENABLE_BEDROCK).');
  }

  try {
    parsed = parseModelJson(rawText);
  } catch (error) {
    console.error(ANSI.red(`\nNova returned non-JSON text:`));
    console.error(ANSI.dim(rawText.slice(0, 2000)));
    persistRun({ ingestId, promptVersion, runtimeConfig, rawText, parsed: null, extraction: null, passed: false });
    fail(EXIT_SCHEMA_FAIL, 'Could not parse Nova output as JSON.');
  }

  const normalizedPayload = normalizeModelExtractionPayload(parsed);

  try {
    extraction = validateSourceExtraction({ payload: normalizedPayload });
  } catch (error) {
    schemaErrors = error.validationErrors || [];
    console.error(ANSI.red(`\nSchema validation failed: ${error.message}`));
    console.error(ANSI.dim(JSON.stringify(schemaErrors, null, 2)));
    console.log(ANSI.bold('\n--- raw Nova output ---'));
    console.log(JSON.stringify(parsed, null, 2));
    persistRun({ ingestId, promptVersion, runtimeConfig, rawText, parsed, extraction: null, passed: false, schemaErrors });
    fail(EXIT_SCHEMA_FAIL, 'Schema fail');
  }

  const finalExtraction = { ...extraction, sourceId: normalized.sourceId, productId: normalized.productId, sourceType: normalized.sourceType };

  console.log(ANSI.bold('\n--- model output ---'));
  console.log(JSON.stringify({
    summary: finalExtraction.summary,
    decisions: finalExtraction.decisions,
    warnings: finalExtraction.warnings,
    confidence: finalExtraction.confidence,
  }, null, 2));

  console.log(ANSI.bold('\n--- assertions ---'));
  const passed = runAssertions(finalExtraction, expectedDoc.assertions || {});

  await persistRun({ ingestId, promptVersion, runtimeConfig, rawText, parsed, extraction: finalExtraction, passed });

  if (!passed) fail(EXIT_CONTENT_FAIL, 'One or more assertions failed.');
  console.log(ANSI.green('\n\u2713 ALL ASSERTIONS PASSED'));
}

main().catch((error) => {
  console.error(ANSI.red(`\nFatal: ${error?.stack || error?.message || error}`));
  process.exit(EXIT_BEDROCK_FAIL);
});
