import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SHARED_PROJECT = 'C:/Projects/AgenticDataCatalog-NoDocker';
const DEFAULT_ENV_FILES = ['.env.local', '.env.aws.example'];

const loadedSources = [];
let envLoaded = false;

function parseLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!match) return null;
  const [, key, rawValue] = match;
  let value = rawValue.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  value = value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
  return { key, value };
}

function loadFileIntoProcess(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, 'utf8');
  let applied = false;
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    if (typeof process.env[parsed.key] === 'undefined' || process.env[parsed.key] === '') {
      process.env[parsed.key] = parsed.value;
      applied = true;
    }
  }
  loadedSources.push(filePath);
  return applied;
}

export function loadEnvFiles({
  projectRoot = process.cwd(),
  sharedProjectRoot = process.env.EIDS_SHARED_CREDENTIALS_PROJECT || DEFAULT_SHARED_PROJECT,
  envFiles = DEFAULT_ENV_FILES,
} = {}) {
  const roots = [projectRoot, sharedProjectRoot].filter(Boolean).map((item) => path.resolve(item));
  for (const root of roots) {
    for (const envFile of envFiles) {
      loadFileIntoProcess(path.join(root, envFile));
    }
  }
  envLoaded = true;
  return { loadedSources: [...loadedSources] };
}

export function ensureEnvLoaded(options = {}) {
  if (!envLoaded) {
    loadEnvFiles(options);
  }
  return { loadedSources: [...loadedSources] };
}

export function envString(name, fallback = '') {
  ensureEnvLoaded();
  const value = process.env[name];
  if (typeof value === 'undefined' || value === null || value === '') return fallback;
  return String(value);
}

export function envInt(name, fallback = 0) {
  const value = Number.parseInt(envString(name, ''), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function envBool(name, fallback = false) {
  const value = envString(name, '');
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

export function getLoadedEnvSources() {
  ensureEnvLoaded();
  return [...loadedSources];
}

ensureEnvLoaded();
