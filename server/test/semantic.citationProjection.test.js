// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { projectExtractionCitations } from '../src/services/semantic/citationProjection.service.js';

describe('semantic citation projection', () => {
  it('projects exact line-range citations when anchor text matches the normalized coordinate map', () => {
    const projected = projectExtractionCitations({
      extraction: {
        summary: 'Vendor confirmed a phased mitigation.',
        decisions: [
          {
            label: 'Proceed with staged mitigation on April 18',
            confidence: 'high',
            anchorText: 'We can proceed with the staged mitigation on April 18.',
          },
        ],
      },
      normalized: {
        normalizedText: [
          'Subject: Mitigation confirmed',
          '',
          'Team,',
          'We can proceed with the staged mitigation on April 18.',
          'Regards,',
        ].join('\n'),
        coordinateMap: [
          { line: 1, text: 'Subject: Mitigation confirmed', offsetStart: 0, offsetEnd: 28 },
          { line: 2, text: '', offsetStart: 29, offsetEnd: 29 },
          { line: 3, text: 'Team,', offsetStart: 30, offsetEnd: 34 },
          { line: 4, text: 'We can proceed with the staged mitigation on April 18.', offsetStart: 35, offsetEnd: 90 },
          { line: 5, text: 'Regards,', offsetStart: 91, offsetEnd: 98 },
        ],
      },
      sourceType: 'email',
    });

    expect(projected.citationMode).toBe('exact');
    expect(projected.citations[0]).toMatchObject({
      kind: 'line_range',
      start: 4,
      end: 4,
      mode: 'exact',
    });
  });

  it('downgrades to fallback mode when anchor text cannot be matched', () => {
    const projected = projectExtractionCitations({
      extraction: {
        summary: 'Vendor confirmed a phased mitigation.',
        decisions: [
          {
            label: 'Proceed with staged mitigation on April 18',
            confidence: 'high',
            anchorText: 'Missing anchor text',
          },
        ],
      },
      normalized: {
        normalizedText: 'Team,\nWe can proceed with the staged mitigation on April 18.\nRegards,',
        coordinateMap: [
          { line: 1, text: 'Team,', offsetStart: 0, offsetEnd: 4 },
          { line: 2, text: 'We can proceed with the staged mitigation on April 18.', offsetStart: 5, offsetEnd: 60 },
          { line: 3, text: 'Regards,', offsetStart: 61, offsetEnd: 68 },
        ],
      },
      sourceType: 'email',
    });

    expect(projected.citationMode).toBe('fallback');
    expect(projected.warningCodes).toContain('CITATION_FALLBACK');
    expect(projected.citations[0].mode).toBe('fallback');
  });
});
