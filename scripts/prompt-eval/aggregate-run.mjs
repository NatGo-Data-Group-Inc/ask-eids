#!/usr/bin/env node
// Aggregate-prompt iteration harness (Phase 2).
//
// Loads scripts/prompt-eval/aggregate-fixtures/<name>.json and the matching
// scripts/prompt-eval/expected/<name>.json, calls Nova Pro with the aggregate
// prompt, validates, and runs assertions against the expected baseline.
//
// Mirrors scripts/prompt-eval/run.mjs — same env vars, same exit codes.
//
// Usage:
//   EIDS_ENABLE_BEDROCK=true EIDS_AWS_REGION=us-east-1 AWS_PROFILE=default \
//     node scripts/prompt-eval/aggregate-run.mjs aggregate-dental-post-wave01

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

async function readJson(p) {
  return JSON.parse(await fs.readFile(p, 'utf8'));
}

function ensureEnv() {
  const errs = [];
  if (process.env.VITEST) errs.push('VITEST is set.');
  if (process.env.NODE_ENV === 'test') errs.push('NODE_ENV=test.');
  if (process.env.EIDS_ENABLE_BEDROCK !== 'true') errs.push('EIDS_ENABLE_BEDROCK must be "true".');
  if (!process.env.EIDS_AWS_REGION && !process.env.AWS_REGION) errs.push('EIDS_AWS_REGION or AWS_REGION required.');
  if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE) errs.push('AWS creds missing.');
  if (errs.length) {
    for (const e of errs) console.error(ANSI.red(`  - ${e}`));
    process.exit(EXIT_ENV_FAIL);
  }
}

async function persistRun({ fixtureName, promptVersion, runtimeConfig, rawText, payload, passed, schemaErrors = null, error = null }) {
  const stamp = new Date().toISOString().replaceAll(':', '').replace(/\..*/, '').replace('T', '-');
  const runDir = path.join(__dirname, 'runs');
  await fs.mkdir(runDir, { recursive: true });
  const runFile = path.join(runDir, `${fixtureName}-${stamp}.json`);
  await fs.writeFile(runFile, JSON.stringify({
    fixtureName,
    promptVersion,
    region: runtimeConfig?.aws?.region,
    modelId: runtimeConfig?.bedrock?.textModelId,
    timestamp: new Date().toISOString(),
    rawText,
    payload,
    schemaErrors,
    error,
    passed,
  }, null, 2), 'utf8');
  console.log(ANSI.dim(`\nrun persisted: ${path.relative(repoRoot, runFile)}`));
}

function runAssertions(payload, fixture, expected) {
  const a = expected.assertions || {};
  const results = [];

  if (a.status) {
    results.push(check(`status === "${a.status}"`, payload.status === a.status, `got "${payload.status}"`));
  }
  if (a.statusLabel) {
    results.push(check(`statusLabel === "${a.statusLabel}"`, payload.statusLabel === a.statusLabel, `got "${payload.statusLabel}"`));
  }
  if (a.confidenceEnum) {
    results.push(check(`confidence in [${a.confidenceEnum.join(',')}]`, a.confidenceEnum.includes(payload.confidence), `got "${payload.confidence}"`));
  }
  if (a.summary) {
    if (typeof a.summary.minLength === 'number') {
      results.push(check(`summary.length >= ${a.summary.minLength}`, String(payload.summary || '').length >= a.summary.minLength, `got ${String(payload.summary || '').length}`));
    }
    if (Array.isArray(a.summary.substringPatterns)) {
      for (const pattern of a.summary.substringPatterns) {
        const re = new RegExp(pattern, 'i');
        results.push(check(`summary matches /${pattern}/i`, re.test(payload.summary || ''), `"${String(payload.summary || '').slice(0, 80)}…"`));
      }
    }
  }
  if (a.drivers) {
    const drivers = Array.isArray(payload.drivers) ? payload.drivers : [];
    if (typeof a.drivers.minCount === 'number') {
      results.push(check(`drivers.length >= ${a.drivers.minCount}`, drivers.length >= a.drivers.minCount, `got ${drivers.length}`));
    }
    if (typeof a.drivers.maxCount === 'number') {
      results.push(check(`drivers.length <= ${a.drivers.maxCount}`, drivers.length <= a.drivers.maxCount, `got ${drivers.length}`));
    }
    if (Array.isArray(a.drivers.anyDirection)) {
      const hit = drivers.find((d) => a.drivers.anyDirection.includes(d.direction));
      results.push(check(`some driver.direction in [${a.drivers.anyDirection.join(',')}]`, Boolean(hit), hit ? `"${hit.title}" → ${hit.direction}` : ''));
    }
  }
  if (a.riskFactors) {
    const risks = Array.isArray(payload.riskFactors) ? payload.riskFactors : [];
    if (typeof a.riskFactors.minCount === 'number') {
      results.push(check(`riskFactors.length >= ${a.riskFactors.minCount}`, risks.length >= a.riskFactors.minCount, `got ${risks.length}`));
    }
    if (typeof a.riskFactors.maxCount === 'number') {
      results.push(check(`riskFactors.length <= ${a.riskFactors.maxCount}`, risks.length <= a.riskFactors.maxCount, `got ${risks.length}`));
    }
    if (Array.isArray(a.riskFactors.anySeverity)) {
      const hit = risks.find((r) => a.riskFactors.anySeverity.includes(r.severity));
      results.push(check(`some riskFactor.severity in [${a.riskFactors.anySeverity.join(',')}]`, Boolean(hit), hit ? `"${hit.title}" → ${hit.severity}` : ''));
    }
  }

  // Always-on: anchorSourceIds must reference known extractions.
  const known = new Set((fixture.extractions || []).map((e) => String(e.sourceId)));
  const bad = [];
  for (const group of ['drivers', 'riskFactors']) {
    const items = Array.isArray(payload[group]) ? payload[group] : [];
    items.forEach((item, index) => {
      (item.anchorSourceIds || []).forEach((id) => {
        if (!known.has(String(id))) bad.push(`${group}[${index}] references "${id}"`);
      });
    });
  }
  results.push(check('all anchorSourceIds map to known extractions', bad.length === 0, bad.length ? bad.join('; ') : `${known.size} known ids`));

  return results.every(Boolean);
}

async function main() {
  const fixtureName = process.argv[2];
  if (!fixtureName) fail(EXIT_ENV_FAIL, 'Usage: node scripts/prompt-eval/aggregate-run.mjs <fixture-name>');

  const fixturePath = path.join(__dirname, 'aggregate-fixtures', `${fixtureName}.json`);
  const expectedPath = path.join(__dirname, 'expected', `${fixtureName}.json`);

  let fixture;
  try { fixture = await readJson(fixturePath); }
  catch (error) { fail(EXIT_ENV_FAIL, `Cannot read fixture: ${error.message}`); }

  let expected;
  try { expected = await readJson(expectedPath); }
  catch (error) { fail(EXIT_ENV_FAIL, `Cannot read expected: ${error.message}`); }

  ensureEnv();

  console.log(ANSI.bold(`\n=== aggregate-eval :: ${fixtureName} ===`));
  console.log(ANSI.dim(`product:    ${fixture.productId} (${fixture.productName})`));
  console.log(ANSI.dim(`extractions: ${fixture.extractions?.length || 0}`));
  console.log(ANSI.dim(`region:     ${process.env.EIDS_AWS_REGION || process.env.AWS_REGION}`));

  const { extractAggregateWithNova } = await import('../../server/src/services/semantic/novaAggregateExtraction.service.js');
  const { getRuntimeConfig } = await import('../../server/src/config/runtime.js');
  const runtimeConfig = getRuntimeConfig();
  const promptVersion = process.env.PROMPT_EVAL_VERSION || 'aggregate-eval-1';
  console.log(ANSI.dim(`prompt:     ${promptVersion}`));

  let result;
  try {
    result = await extractAggregateWithNova({
      productId: fixture.productId,
      productName: fixture.productName,
      productMission: fixture.productMission,
      extractions: fixture.extractions,
      executionDecision: { promptVersion, executionMode: 'live' },
      runtimeConfig,
    });
  } catch (error) {
    if (error.code === 'AGGREGATE_CONTENT_INVALID') {
      console.error(ANSI.red(`\nAggregate validation failed: ${error.message}`));
      console.error(ANSI.dim(JSON.stringify(error.validationErrors || {}, null, 2)));
      await persistRun({ fixtureName, promptVersion, runtimeConfig, rawText: null, payload: null, passed: false, schemaErrors: error.validationErrors });
      fail(EXIT_SCHEMA_FAIL, 'Schema or content fail.');
    }
    await persistRun({ fixtureName, promptVersion, runtimeConfig, rawText: null, payload: null, passed: false, error: String(error.stack || error.message) });
    fail(EXIT_BEDROCK_FAIL, `Bedrock call failed: ${error.message}`);
  }

  const payload = result.payload;
  console.log(ANSI.bold('\n--- model output ---'));
  console.log(JSON.stringify(payload, null, 2));

  console.log(ANSI.bold('\n--- assertions ---'));
  const passed = runAssertions(payload, fixture, expected);

  await persistRun({ fixtureName, promptVersion, runtimeConfig, rawText: result.rawOutputText, payload, passed });

  if (!passed) fail(EXIT_CONTENT_FAIL, 'One or more assertions failed.');
  console.log(ANSI.green('\n\u2713 ALL ASSERTIONS PASSED'));
}

main().catch((error) => {
  console.error(ANSI.red(`\nFatal: ${error?.stack || error?.message || error}`));
  process.exit(EXIT_BEDROCK_FAIL);
});
