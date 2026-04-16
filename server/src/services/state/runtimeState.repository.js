import duckdb from 'duckdb';
import fs from 'node:fs/promises';

function execSql(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function runSql(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, ...params, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function allSql(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, ...params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows ?? []);
    });
  });
}

function firstRow(rows) {
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function ensureSchema(db) {
  await execSql(
    db,
    `
    CREATE TABLE IF NOT EXISTS state_meta (
      key VARCHAR PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_products (
      product_id VARCHAR PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_product_data (
      product_id VARCHAR PRIMARY KEY,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_reports (
      report_id VARCHAR PRIMARY KEY,
      product_id VARCHAR,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_jobs (
      job_id VARCHAR PRIMARY KEY,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_source_extractions (
      source_id VARCHAR PRIMARY KEY,
      product_id VARCHAR,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_product_aggregates (
      aggregate_id VARCHAR PRIMARY KEY,
      product_id VARCHAR,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_prompt_runs (
      run_id VARCHAR PRIMARY KEY,
      sort_order BIGINT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_connector_profiles (
      connector_profile_id VARCHAR PRIMARY KEY,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_sync_runs (
      sync_run_id VARCHAR PRIMARY KEY,
      sort_order BIGINT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_telemetry (
      event_id VARCHAR PRIMARY KEY,
      sort_order BIGINT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_audit (
      audit_event_id VARCHAR PRIMARY KEY,
      sort_order BIGINT NOT NULL,
      payload_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_next_ids (
      key VARCHAR PRIMARY KEY,
      value BIGINT NOT NULL
    );
    `
  );
}

async function replaceStateRows(db, state) {
  await execSql(db, 'BEGIN TRANSACTION');
  try {
    await execSql(db, 'DELETE FROM state_meta');
    await execSql(db, 'DELETE FROM state_products');
    await execSql(db, 'DELETE FROM state_product_data');
    await execSql(db, 'DELETE FROM state_reports');
    await execSql(db, 'DELETE FROM state_jobs');
    await execSql(db, 'DELETE FROM state_source_extractions');
    await execSql(db, 'DELETE FROM state_product_aggregates');
    await execSql(db, 'DELETE FROM state_prompt_runs');
    await execSql(db, 'DELETE FROM state_connector_profiles');
    await execSql(db, 'DELETE FROM state_sync_runs');
    await execSql(db, 'DELETE FROM state_telemetry');
    await execSql(db, 'DELETE FROM state_audit');
    await execSql(db, 'DELETE FROM state_next_ids');

    await runSql(db, 'INSERT INTO state_meta (key, value_json) VALUES (?, ?)', ['session', JSON.stringify(state.session ?? {})]);
    await runSql(db, 'INSERT INTO state_meta (key, value_json) VALUES (?, ?)', ['role_presets', JSON.stringify(state.rolePresets ?? {})]);
    await runSql(db, 'INSERT INTO state_meta (key, value_json) VALUES (?, ?)', ['product_role_scopes', JSON.stringify(state.productRoleScopes ?? {})]);
    await runSql(db, 'INSERT INTO state_meta (key, value_json) VALUES (?, ?)', ['imported_corpus', JSON.stringify(state.importedCorpus ?? {})]);
    await runSql(db, 'INSERT INTO state_meta (key, value_json) VALUES (?, ?)', ['semantic_config', JSON.stringify(state.semanticConfig ?? {})]);

    for (const [index, product] of (state.products ?? []).entries()) {
      await runSql(
        db,
        'INSERT INTO state_products (product_id, sort_order, payload_json) VALUES (?, ?, ?)',
        [product.id, index, JSON.stringify(product)]
      );
    }

    for (const [productId, productData] of Object.entries(state.productData ?? {})) {
      await runSql(
        db,
        'INSERT INTO state_product_data (product_id, payload_json) VALUES (?, ?)',
        [productId, JSON.stringify(productData)]
      );
    }

    for (const [reportId, report] of Object.entries(state.reports ?? {})) {
      await runSql(
        db,
        'INSERT INTO state_reports (report_id, product_id, payload_json) VALUES (?, ?, ?)',
        [reportId, report?.productId ?? null, JSON.stringify(report)]
      );
    }

    for (const [jobId, job] of Object.entries(state.jobs ?? {})) {
      await runSql(db, 'INSERT INTO state_jobs (job_id, payload_json) VALUES (?, ?)', [jobId, JSON.stringify(job)]);
    }

    for (const extraction of (state.sourceExtractions ?? [])) {
      await runSql(
        db,
        'INSERT INTO state_source_extractions (source_id, product_id, payload_json) VALUES (?, ?, ?)',
        [extraction.sourceId, extraction.productId ?? null, JSON.stringify(extraction)]
      );
    }

    for (const aggregate of (state.productAggregates ?? [])) {
      await runSql(
        db,
        'INSERT INTO state_product_aggregates (aggregate_id, product_id, payload_json) VALUES (?, ?, ?)',
        [aggregate.aggregateId, aggregate.productId ?? null, JSON.stringify(aggregate)]
      );
    }

    for (const [index, run] of (state.promptRuns ?? []).entries()) {
      const runId = run?.runId || `run-${index}`;
      await runSql(
        db,
        'INSERT INTO state_prompt_runs (run_id, sort_order, payload_json) VALUES (?, ?, ?)',
        [runId, index, JSON.stringify(run)]
      );
    }

    for (const [profileId, profile] of Object.entries(state.connectorProfiles ?? {})) {
      await runSql(
        db,
        'INSERT INTO state_connector_profiles (connector_profile_id, payload_json) VALUES (?, ?)',
        [profileId, JSON.stringify(profile)]
      );
    }

    for (const [index, run] of (state.syncRuns ?? []).entries()) {
      const syncRunId = run?.syncRunId || `sync-${index}`;
      await runSql(
        db,
        'INSERT INTO state_sync_runs (sync_run_id, sort_order, payload_json) VALUES (?, ?, ?)',
        [syncRunId, index, JSON.stringify(run)]
      );
    }

    for (const [index, event] of (state.telemetryEvents ?? []).entries()) {
      await runSql(
        db,
        'INSERT INTO state_telemetry (event_id, sort_order, payload_json) VALUES (?, ?, ?)',
        [`telemetry-${index}`, index, JSON.stringify(event)]
      );
    }

    for (const [index, event] of (state.auditEvents ?? []).entries()) {
      const auditId = event?.auditEventId || `audit-${index}`;
      await runSql(
        db,
        'INSERT INTO state_audit (audit_event_id, sort_order, payload_json) VALUES (?, ?, ?)',
        [auditId, index, JSON.stringify(event)]
      );
    }

    for (const [key, value] of Object.entries(state.nextIds ?? {})) {
      await runSql(db, 'INSERT INTO state_next_ids (key, value) VALUES (?, ?)', [key, Number(value)]);
    }

    await execSql(db, 'COMMIT');
  } catch (error) {
    await execSql(db, 'ROLLBACK');
    throw error;
  }
}

async function readStateRows(db) {
  const metaRows = await allSql(db, 'SELECT key, value_json FROM state_meta');
  const products = await allSql(db, 'SELECT payload_json FROM state_products ORDER BY sort_order ASC');
  const productDataRows = await allSql(db, 'SELECT product_id, payload_json FROM state_product_data');
  const reportRows = await allSql(db, 'SELECT report_id, payload_json FROM state_reports');
  const jobRows = await allSql(db, 'SELECT job_id, payload_json FROM state_jobs');
  const sourceExtractionRows = await allSql(db, 'SELECT payload_json FROM state_source_extractions ORDER BY product_id ASC, source_id ASC');
  const productAggregateRows = await allSql(db, 'SELECT payload_json FROM state_product_aggregates ORDER BY product_id ASC, aggregate_id ASC');
  const promptRunRows = await allSql(db, 'SELECT payload_json FROM state_prompt_runs ORDER BY sort_order ASC');
  const connectorProfileRows = await allSql(db, 'SELECT connector_profile_id, payload_json FROM state_connector_profiles');
  const syncRunRows = await allSql(db, 'SELECT payload_json FROM state_sync_runs ORDER BY sort_order ASC');
  const telemetryRows = await allSql(db, 'SELECT payload_json FROM state_telemetry ORDER BY sort_order ASC');
  const auditRows = await allSql(db, 'SELECT payload_json FROM state_audit ORDER BY sort_order ASC');
  const nextIdRows = await allSql(db, 'SELECT key, value FROM state_next_ids');

  const meta = Object.fromEntries(metaRows.map((row) => [row.key, parseJson(row.value_json, {})]));

  return {
    session: meta.session ?? {},
    rolePresets: meta.role_presets ?? {},
    productRoleScopes: meta.product_role_scopes ?? {},
    products: products.map((row) => parseJson(row.payload_json, {})).filter((row) => row && row.id),
    productData: Object.fromEntries(productDataRows.map((row) => [row.product_id, parseJson(row.payload_json, {})])),
    reports: Object.fromEntries(reportRows.map((row) => [row.report_id, parseJson(row.payload_json, {})])),
    jobs: Object.fromEntries(jobRows.map((row) => [row.job_id, parseJson(row.payload_json, {})])),
    sourceExtractions: sourceExtractionRows.map((row) => parseJson(row.payload_json, {})).filter(Boolean),
    productAggregates: productAggregateRows.map((row) => parseJson(row.payload_json, {})).filter(Boolean),
    promptRuns: promptRunRows.map((row) => parseJson(row.payload_json, {})).filter(Boolean),
    connectorProfiles: Object.fromEntries(connectorProfileRows.map((row) => [row.connector_profile_id, parseJson(row.payload_json, {})])),
    syncRuns: syncRunRows.map((row) => parseJson(row.payload_json, {})).filter(Boolean),
    telemetryEvents: telemetryRows.map((row) => parseJson(row.payload_json, {})),
    auditEvents: auditRows.map((row) => parseJson(row.payload_json, {})),
    nextIds: Object.fromEntries(nextIdRows.map((row) => [row.key, Number(row.value)])),
    importedCorpus: meta.imported_corpus ?? {},
    semanticConfig: meta.semantic_config ?? {},
  };
}

export function createRuntimeStateRepository({ runtimeDir, stateDbFile, seedStateFactory }) {
  let databasePromise = null;
  let operationChain = Promise.resolve();

  async function getDatabase() {
    if (!databasePromise) {
      databasePromise = (async () => {
        await fs.mkdir(runtimeDir, { recursive: true });
        const db = new duckdb.Database(stateDbFile);
        await ensureSchema(db);
        return db;
      })();
    }

    return databasePromise;
  }

  async function runSerialized(operation) {
    const nextOperation = operationChain.then(operation);
    operationChain = nextOperation.catch(() => {});
    return nextOperation;
  }

  async function ensureSeededState(db) {
    const countRows = await allSql(db, 'SELECT COUNT(*) AS count FROM state_products');
    const count = Number(firstRow(countRows)?.count ?? 0);
    if (count > 0) {
      return;
    }

    if (typeof seedStateFactory === 'function') {
      const seedState = await seedStateFactory();
      await replaceStateRows(db, seedState);
    }
  }

  async function ensureInitialized() {
    return runSerialized(async () => {
      const db = await getDatabase();
      await ensureSeededState(db);
    });
  }

  async function resetWithSeed() {
    return runSerialized(async () => {
      const db = await getDatabase();
      const seedState = await seedStateFactory();
      await replaceStateRows(db, seedState);
      return seedState;
    });
  }

  async function readState() {
    return runSerialized(async () => {
      const db = await getDatabase();
      await ensureSeededState(db);
      return readStateRows(db);
    });
  }

  async function writeState(nextState) {
    return runSerialized(async () => {
      const db = await getDatabase();
      await replaceStateRows(db, nextState);
      return nextState;
    });
  }

  async function updateState(mutator) {
    return runSerialized(async () => {
      const db = await getDatabase();
      await ensureSeededState(db);
      const current = await readStateRows(db);
      const next = await mutator(structuredClone(current));
      await replaceStateRows(db, next);
      return next;
    });
  }

  return {
    ensureInitialized,
    resetWithSeed,
    readState,
    writeState,
    updateState,
  };
}
