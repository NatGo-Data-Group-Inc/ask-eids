import duckdb from 'duckdb';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getRuntimeConfig } from '../config/runtime.js';
import { embedQuery, embedTexts, getEmbeddingDims } from '../lib/aws/titanEmbeddings.js';

const runtimeConfig = getRuntimeConfig();
const ragDir = runtimeConfig.storage.paths.runtimeDir;
const ragFile = runtimeConfig.storage.paths.duckDbFile;
const VECTOR_SIZE = getEmbeddingDims(runtimeConfig);
const DEFAULT_APPLICATION = 'AskEIDS';

let databasePromise = null;
let operationChain = Promise.resolve();

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

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      await fs.mkdir(ragDir, { recursive: true });
      const db = new duckdb.Database(ragFile);
      await execSql(
        db,
        `
        CREATE TABLE IF NOT EXISTS rag_chunks (
          chunk_id VARCHAR PRIMARY KEY,
          doc_id VARCHAR NOT NULL,
          application VARCHAR NOT NULL,
          environment VARCHAR NOT NULL,
          product_id VARCHAR,
          source_id VARCHAR,
          source_type VARCHAR,
          title VARCHAR,
          source_date VARCHAR,
          token_text TEXT,
          text TEXT NOT NULL,
          embedding_json TEXT NOT NULL,
          metadata_json TEXT NOT NULL,
          indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `
      );
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

function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .match(/[a-z0-9]{2,}/g) ?? [];
}

function cosineSimilarity(left, right) {
  if (!left.length || !right.length) {
    return 0;
  }

  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    dotProduct += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dotProduct / Math.sqrt(leftMagnitude * rightMagnitude);
}

function keywordOverlap(queryTokens, candidateTokens) {
  if (!queryTokens.length || !candidateTokens.length) {
    return 0;
  }

  const querySet = new Set(queryTokens);
  let matches = 0;
  for (const token of candidateTokens) {
    if (querySet.has(token)) {
      matches += 1;
    }
  }

  return matches / querySet.size;
}

function normalizeMetadata(metadata = {}, docId) {
  return {
    application: metadata.application ?? DEFAULT_APPLICATION,
    environment: metadata.environment ?? process.env.NODE_ENV ?? 'development',
    productId: metadata.productId ?? null,
    sourceId: metadata.sourceId ?? docId,
    sourceType: metadata.sourceType ?? 'document',
    title: metadata.title ?? docId,
    sourceDate: metadata.sourceDate ?? null,
    participants: metadata.participants ?? [],
    author: metadata.author ?? null,
    ...metadata,
  };
}

function buildSearchText(document) {
  const title = document.metadata?.title ?? document.docId ?? '';
  return `${title} ${document.text}`.trim();
}

async function indexDocuments(documents) {
  await runSerialized(async () => {
    const db = await getDatabase();
    const searchTexts = documents.map((document) => buildSearchText(document));
    const embeddings = await embedTexts(searchTexts);
    for (const [index, document] of documents.entries()) {
      const metadata = normalizeMetadata(document.metadata, document.docId);
      const searchText = searchTexts[index];
      const embedding = embeddings[index] ?? Array.from({ length: VECTOR_SIZE }, () => 0);
      const tokenText = tokenize(searchText).join(' ');

      await runSql(db, 'DELETE FROM rag_chunks WHERE chunk_id = ?', [document.chunkId]);
      await runSql(
        db,
        `
        INSERT INTO rag_chunks (
          chunk_id,
          doc_id,
          application,
          environment,
          product_id,
          source_id,
          source_type,
          title,
          source_date,
          token_text,
          text,
          embedding_json,
          metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          document.chunkId,
          document.docId,
          metadata.application,
          metadata.environment,
          metadata.productId,
          metadata.sourceId,
          metadata.sourceType,
          metadata.title,
          metadata.sourceDate,
          tokenText,
          document.text,
          JSON.stringify(embedding),
          JSON.stringify(metadata),
        ]
      );
    }
  });
}

async function search({ query, filters = {}, topK = 8 }) {
  return runSerialized(async () => {
    const db = await getDatabase();
    const application = filters.application ?? DEFAULT_APPLICATION;
    const environment = filters.environment ?? process.env.NODE_ENV ?? 'development';
    const productId = filters.productId ?? null;
    const sourceType = filters.sourceType ?? null;
    const sourceId = filters.sourceId ?? null;

    const rows = await allSql(
      db,
      `
      SELECT
        chunk_id AS chunkId,
        doc_id AS docId,
        application,
        environment,
        product_id AS productId,
        source_id AS sourceId,
        source_type AS sourceType,
        title,
        source_date AS sourceDate,
        token_text AS tokenText,
        text,
        embedding_json AS embeddingJson,
        metadata_json AS metadataJson
      FROM rag_chunks
      WHERE application = ?
        AND environment = ?
        AND (? IS NULL OR product_id = ?)
        AND (? IS NULL OR source_type = ?)
        AND (? IS NULL OR source_id = ?)
      LIMIT 250
      `,
      [application, environment, productId, productId, sourceType, sourceType, sourceId, sourceId]
    );

    const queryTokens = tokenize(query);
    const queryEmbedding = await embedQuery(query);

    return rows
      .map((row) => {
        const embedding = JSON.parse(row.embeddingJson);
        const candidateTokens = row.tokenText ? row.tokenText.split(' ') : tokenize(row.text);
        const cosine = cosineSimilarity(queryEmbedding, embedding);
        const overlap = keywordOverlap(queryTokens, candidateTokens);
        const score = Number((cosine * 0.65 + overlap * 0.35).toFixed(6));
        return {
          chunkId: row.chunkId,
          docId: row.docId,
          text: row.text,
          score,
          metadata: JSON.parse(row.metadataJson),
        };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  });
}

export async function createPrototypeDuckDbStore() {
  await getDatabase();
  return {
    indexDocuments,
    search,
  };
}

export async function resetPrototypeDuckDbStore() {
  await runSerialized(async () => {
    const db = await getDatabase();
    await execSql(db, 'DELETE FROM rag_chunks');
  });
}
