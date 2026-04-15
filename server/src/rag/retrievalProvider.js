import { createPrototypeDuckDbStore } from './prototypeDuckDbStore.js';

export async function getRetrievalProvider() {
  const provider = process.env.EIDS_RETRIEVAL_PROVIDER ?? process.env.VECTOR_STORE_PROVIDER ?? 'duckdb';

  if (provider === 'duckdb' || provider === 'duckdb-bedrock' || provider === 'kb') {
    return createPrototypeDuckDbStore();
  }

  throw new Error(`Unknown retrieval provider: ${provider}`);
}
