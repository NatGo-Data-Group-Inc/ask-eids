// @vitest-environment node
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildApp, resetRuntimeData } from '../src/app.js';
import {
  createPrototypeDuckDbStore,
  resetPrototypeDuckDbStore,
} from '../src/rag/prototypeDuckDbStore.js';

describe('prototype DuckDB retrieval', () => {
  beforeEach(async () => {
    process.env.EIDS_SKIP_CORPUS_INDEX = '0';
    await resetRuntimeData();
    await resetPrototypeDuckDbStore();
  });

  it('stores and searches indexed chunks with product filters', async () => {
    const store = await createPrototypeDuckDbStore();
    await store.indexDocuments([
      {
        chunkId: 'dental-1',
        docId: 'src-dental-1',
        text: 'FHIR migration priority and vendor confirmation are the main dental decisions.',
        metadata: {
          productId: 'dental',
          sourceType: 'transcript',
          title: 'Dental Sprint Review',
        },
      },
      {
        chunkId: 'optima-1',
        docId: 'src-optima-1',
        text: 'Optima deployment notes and staffing plan.',
        metadata: {
          productId: 'optima',
          sourceType: 'weekly',
          title: 'Optima Weekly Update',
        },
      },
    ]);

    const results = await store.search({
      query: 'vendor confirmation dental decision',
      filters: { productId: 'dental' },
      topK: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].chunkId).toBe('dental-1');
    expect(results[0].metadata.productId).toBe('dental');
  });

  it('indexes uploaded transcript content so Ask can cite the new evidence', async () => {
    const app = await buildApp();
    const uploadResponse = await request(app)
      .post('/api/v1/products/dental/transcripts')
      .field('meetingTitle', 'Vendor Readiness Meeting')
      .field('meetingDate', '2026-04-14')
      .field('attendees', 'Lowry')
      .field('attendees', 'Juan')
      .field('notes', 'Decision captured during vendor readiness review.')
      .attach(
        'file',
        Buffer.from('Decision: Vendor contract review will happen Friday. Action: Juan will confirm the package with Lowry.'),
        'vendor-readiness.txt'
      );

    expect(uploadResponse.status).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const askResponse = await request(app)
      .post('/api/v1/products/dental/ask')
      .send({ question: 'What decision was made in the vendor readiness meeting?' });

    expect(askResponse.status).toBe(200);
    expect(askResponse.body.answerHtml).toContain('Evidence-backed response');
    expect(askResponse.body.sources.some((source) => source.title === 'Vendor Readiness Meeting')).toBe(true);
  });
});
