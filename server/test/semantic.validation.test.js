// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validateSourceExtraction } from '../src/services/semantic/extractionValidation.service.js';
import { validateAggregatePayload } from '../src/services/semantic/aggregateValidation.service.js';
import { normalizeModelExtractionPayload, parseModelJson } from '../src/services/semantic/novaSourceExtraction.service.js';

describe('semantic validation services', () => {
  it('accepts retrieval-eligible source extraction payloads that match the schema', () => {
    const validated = validateSourceExtraction({
      sourceFamily: 'email',
      payload: {
        summary: 'Vendor confirmed staged mitigation.',
        decisions: [
          {
            label: 'Proceed with staged mitigation on April 18',
            confidence: 'high',
            anchorText: 'We can proceed with staged mitigation on April 18.',
          },
        ],
        warnings: [],
        confidence: 'high',
      },
    });

    expect(validated.summary).toBe('Vendor confirmed staged mitigation.');
    expect(validated.decisions).toHaveLength(1);
  });

  it('rejects parseable but schema-invalid extraction payloads', () => {
    try {
      validateSourceExtraction({
        sourceFamily: 'email',
        payload: {
          summary: 42,
          decisions: 'not-an-array',
          warnings: [],
          confidence: 'high',
        },
      });
      throw new Error('Expected validation to fail.');
    } catch (error) {
      expect(error.code).toBe('EXTRACTION_INVALID');
      expect(error.validationErrors?.length).toBeGreaterThan(0);
    }
  });

  it('accepts aggregate payloads only when the publication contract is satisfied', () => {
    const validated = validateAggregatePayload({
      productId: 'dental',
      aggregatePayload: {
        aggregateId: 'agg-dental-4',
        productId: 'dental',
        aggregateVersion: 4,
        evidenceVersion: 12,
        sourceSetHash: '4a6e2e6b5f5b91452fbf6f92ef447cf7d0f2d05f8c4d57d9fbcf76d7f52f8d5f',
        payload: {
          summary: 'Dental remains at risk because vendor staging remains gated by April 18 mitigation sequencing.',
          status: 'risk',
        },
      },
    });

    expect(validated.aggregateVersion).toBe(4);
    expect(validated.payload.status).toBe('risk');
  });

  it('rejects invalid aggregate payloads before publish', () => {
    try {
      validateAggregatePayload({
        productId: 'dental',
        aggregatePayload: {
          aggregateId: 'agg-dental-4',
          productId: 'dental',
          aggregateVersion: 4,
          evidenceVersion: 12,
          sourceSetHash: '',
          payload: {
            summary: '',
            status: 'unknown',
          },
        },
      });
      throw new Error('Expected aggregate validation to fail.');
    } catch (error) {
      expect(error.code).toBe('AGGREGATE_INVALID');
      expect(error.validationErrors?.length).toBeGreaterThan(0);
    }
  });

  it('parses fenced json returned by a live model response', () => {
    const parsed = parseModelJson(`\`\`\`json
{
  "summary": "Vendor confirmed staged mitigation.",
  "decisions": [],
  "warnings": [],
  "confidence": "high"
}
\`\`\``);

    expect(parsed).toMatchObject({
      summary: 'Vendor confirmed staged mitigation.',
      confidence: 'high',
    });
  });

  it('normalizes numeric confidences from a live model into schema-valid enum values', () => {
    const normalized = normalizeModelExtractionPayload({
      summary: 'Vendor confirmed staged mitigation.',
      decisions: [
        {
          label: 'mitigation_confirmed',
          confidence: 0.95,
          anchorText: 'We can proceed with the staged mitigation on April 18.',
        },
      ],
      warnings: [],
      confidence: 0.95,
    });

    expect(normalized).toMatchObject({
      confidence: 'high',
      decisions: [
        expect.objectContaining({
          confidence: 'high',
        }),
      ],
    });
    expect(() => validateSourceExtraction({ sourceFamily: 'email', payload: normalized })).not.toThrow();
  });

  it('derives a conservative top-level confidence when the live model omits it', () => {
    const normalized = normalizeModelExtractionPayload({
      summary: 'Vendor confirmed staged mitigation.',
      decisions: [
        {
          label: 'mitigation_confirmed',
          confidence: 'high',
          anchorText: 'We can proceed with the staged mitigation on April 18.',
        },
        {
          label: 'packet_delivery',
          confidence: 'medium',
          anchorText: 'I also confirmed the recovery packet will be delivered before close of business.',
        },
      ],
      warnings: [],
    });

    expect(normalized.confidence).toBe('medium');
    expect(() => validateSourceExtraction({ sourceFamily: 'email', payload: normalized })).not.toThrow();
  });
});
