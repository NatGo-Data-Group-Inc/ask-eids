import path from 'node:path';
import { envBool, envInt, envString, getLoadedEnvSources } from './env.js';

const DEFAULT_REGION = 'us-gov-west-1';
const DEFAULT_TEXT_MODEL = 'amazon.nova-pro-v1:0';
const DEFAULT_EMBED_MODEL = 'amazon.titan-embed-text-v2:0';
const DEFAULT_SHARED_PROJECT = 'C:/Projects/AgenticDataCatalog-NoDocker';

function resolveRuntimeDir() {
  const testWorkerId = process.env.VITEST_POOL_ID
    ?? process.env.VITEST_WORKER_ID
    ?? ((process.env.VITEST || process.env.NODE_ENV === 'test') ? String(process.pid) : '');
  return testWorkerId ? path.resolve(`server/data/test-${testWorkerId}`) : path.resolve('server/data');
}

export function getRuntimePaths() {
  const runtimeDir = resolveRuntimeDir();
  return {
    runtimeDir,
    runtimeFile: path.join(runtimeDir, 'runtime-db.json'),
    stateDbFile: path.join(runtimeDir, 'runtime-state.duckdb'),
    uploadsDir: path.join(runtimeDir, 'uploads'),
    exportsDir: path.join(runtimeDir, 'exports'),
    artifactsDir: path.join(runtimeDir, 'artifacts'),
    rawArtifactsDir: path.join(runtimeDir, 'artifacts', 'raw'),
    normalizedArtifactsDir: path.join(runtimeDir, 'artifacts', 'normalized'),
    exportArtifactsDir: path.join(runtimeDir, 'artifacts', 'exports'),
    duckDbFile: path.join(runtimeDir, 'prototype-rag.duckdb'),
  };
}

export function getRuntimeConfig() {
  const isTest = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
  const bedrockEnabled = envBool('EIDS_ENABLE_BEDROCK', false);
  const appEnv = envString('NODE_ENV', 'development');
  const isProduction = appEnv === 'production';
  const region = envString('EIDS_AWS_REGION', envString('AWS_REGION', DEFAULT_REGION)).trim() || DEFAULT_REGION;
  const rawBucket = envString('AWS_S3_RAW_BUCKET', envString('KB_S3_BUCKET', envString('DOCS_TEXTRACT_S3_BUCKET', ''))).trim();
  const normalizedBucket = envString('AWS_S3_NORMALIZED_BUCKET', rawBucket).trim();
  const exportBucket = envString('AWS_S3_EXPORT_BUCKET', rawBucket).trim();
  const textModelId = envString('BEDROCK_GEN_MODEL_ID', envString('BEDROCK_TEXT_MODEL_ID', DEFAULT_TEXT_MODEL)).trim() || DEFAULT_TEXT_MODEL;
  const embedModelId = envString('BEDROCK_EMBED_MODEL_ID', DEFAULT_EMBED_MODEL).trim() || DEFAULT_EMBED_MODEL;
  const embedDims = envInt('EMBEDDING_DIMS', 512);
  const artifactStoreMode = envString('EIDS_ARTIFACT_STORE_MODE', isTest ? 'filesystem' : '').trim()
    || ((isProduction && rawBucket && normalizedBucket && exportBucket) ? 's3' : 'filesystem');
  const sharedCredentialsProject = envString('EIDS_SHARED_CREDENTIALS_PROJECT', DEFAULT_SHARED_PROJECT).trim() || DEFAULT_SHARED_PROJECT;

  return {
    app: {
      env: appEnv,
      baseUrl: envString('APP_BASE_URL', ''),
      port: envInt('PORT', 3000),
      telemetryEnabled: envBool('TELEMETRY_ENABLED', true),
      unsupportedMobile: envBool('FEATURE_UNSUPPORTED_MOBILE', true),
    },
    aws: {
      region,
      rawBucket,
      normalizedBucket,
      exportBucket,
      useFips: envBool('AWS_USE_FIPS_ENDPOINT', region.startsWith('us-gov-')),
    },
    bedrock: {
      region,
      textModelId,
      embedModelId,
      embedDims,
      allowedTextModelIds: envString('BEDROCK_ALLOWED_TEXT_MODEL_IDS', 'amazon.nova-lite-v1:0,amazon.nova-pro-v1:0')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    },
    textract: {
      enabled: envBool('DOCS_TEXTRACT_ENABLED', true),
      region: envString('EIDS_TEXTRACT_REGION', region).trim() || region,
      pdfMode: envString('DOCS_TEXTRACT_PDF_MODE', 'detect-document-text').trim() || 'detect-document-text',
      bucket: envString('DOCS_TEXTRACT_S3_BUCKET', rawBucket).trim(),
      prefix: envString('DOCS_TEXTRACT_S3_PREFIX', 'textract').trim() || 'textract',
      minTextChars: envInt('DOCS_PDF_OCR_MIN_TEXT_CHARS', 80),
      timeoutMs: envInt('DOCS_TEXTRACT_TIMEOUT_MS', 180000),
      pollIntervalMs: envInt('DOCS_TEXTRACT_POLL_INTERVAL_MS', 4000),
    },
    storage: {
      mode: artifactStoreMode,
      paths: getRuntimePaths(),
    },
    retrieval: {
      provider: envString('EIDS_RETRIEVAL_PROVIDER', envString('VECTOR_STORE_PROVIDER', 'duckdb')).trim() || 'duckdb',
      allowPseudoEmbeddings: envBool('EIDS_ALLOW_PSEUDO_EMBEDDINGS', isTest || !bedrockEnabled),
    },
    connectors: {
      enableAdoMcpEnrichment: envBool('ENABLE_ADO_MCP_ENRICHMENT', false),
      lagAlertMinutes: envInt('CONNECTOR_LAG_ALERT_MINUTES', 120),
      failureStreakAlertThreshold: envInt('CONNECTOR_FAILURE_STREAK_ALERT_THRESHOLD', 3),
    },
    sharedCredentialsProject,
    envSources: getLoadedEnvSources(),
  };
}

export function assertSingleRegionOperation(config = getRuntimeConfig()) {
  const region = config.aws.region;
  if (!String(region).startsWith('us-gov-')) {
    const error = new Error(`Configured AWS region \"${region}\" is outside the required GovCloud partition.`);
    error.code = 'REGION_NOT_GOVCLOUD';
    throw error;
  }
  if (config.bedrock.region !== region) {
    const error = new Error('Bedrock region must match the configured AWS region for single-region operation.');
    error.code = 'BEDROCK_REGION_MISMATCH';
    throw error;
  }
  if (config.textract.enabled && config.textract.region && config.textract.region !== region) {
    const error = new Error('Textract region must match the configured AWS region for single-region operation.');
    error.code = 'TEXTRACT_REGION_MISMATCH';
    throw error;
  }
  return true;
}

export function getRuntimeDiagnostics() {
  const config = getRuntimeConfig();
  return {
    appEnv: config.app.env,
    awsRegion: config.aws.region,
    storageMode: config.storage.mode,
    rawBucketConfigured: Boolean(config.aws.rawBucket),
    normalizedBucketConfigured: Boolean(config.aws.normalizedBucket),
    exportBucketConfigured: Boolean(config.aws.exportBucket),
    textModelId: config.bedrock.textModelId,
    embedModelId: config.bedrock.embedModelId,
    sharedCredentialsProject: config.sharedCredentialsProject,
    envSources: config.envSources,
  };
}
