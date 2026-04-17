// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { askPrecedenceMerge } from '../src/services/domain/askPrecedence.service.js';

describe('ask precedence merge', () => {
  it('returns deterministic merged output for the same frozen inputs', () => {
    const input = {
      question: 'When is the staged mitigation due?',
      productId: 'dental',
      structuredHits: [
        {
          sourceId: 'src-risk-12',
          sourceType: 'risk_export',
          matchedFieldName: 'mitigation_due_date',
          fieldValue: '2026-04-18',
          matchConfidence: 0.95,
          sourceDate: '2026-04-16T00:00:00.000Z',
        },
      ],
      vectorHits: [
        {
          sourceId: 'src-2401',
          sourceType: 'email',
          chunkId: 'src-2401::2',
          score: 0.82,
          sourceDate: '2026-04-15T00:00:00.000Z',
          assertsFieldName: 'mitigation_due_date',
          assertedFieldValue: '2026-04-19',
        },
      ],
      productSourceIndex: [
        {
          sourceId: 'src-2401',
          sourceType: 'email',
          sourceFamilyClass: 'retrieval_eligible',
          indexingStatus: 'indexed',
          productScopedTextMatch: true,
        },
      ],
    };

    const first = askPrecedenceMerge(input);
    const second = askPrecedenceMerge(structuredClone(input));

    expect(first).toEqual(second);
    expect(first.decision).toMatchObject({
      exactFieldConflict: true,
      winner: 'structured',
      narrativeCitedForContext: true,
      resolution: 'structured_wins_conflict',
    });
    expect(first.sources[0]).toMatchObject({
      sourceId: 'src-risk-12',
      retrievalType: 'structured',
    });
    expect(first.sources[1]).toMatchObject({
      sourceId: 'src-2401',
      retrievalType: 'vector',
      precedenceNote: 'Cited for context; structured row is the field-of-record.',
      conflictingFieldValue: '2026-04-19',
    });
  });

  it('emits RETRIEVAL_NOT_READY warnings for matching non-retrievable sources', () => {
    const result = askPrecedenceMerge({
      question: 'What did the vendor confirm?',
      productId: 'dental',
      structuredHits: [],
      vectorHits: [],
      productSourceIndex: [
        {
          sourceId: 'src-2401',
          sourceType: 'email',
          sourceFamilyClass: 'retrieval_eligible',
          indexingStatus: 'failed',
          productScopedTextMatch: true,
        },
      ],
    });

    expect(result.retrievalWarnings).toEqual([
      {
        code: 'RETRIEVAL_NOT_READY',
        sourceId: 'src-2401',
        indexingStatus: 'failed',
      },
    ]);
  });
});
