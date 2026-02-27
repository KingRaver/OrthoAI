import { describe, expect, it } from 'vitest';
import { classifyEvidence, evidenceLevelToOrdinal } from '@/app/lib/knowledge/evidence/ranking';

// Dynamic dates so recency tiers remain accurate regardless of when tests run.
const yearAgo = (n: number): string => `${new Date().getFullYear() - n}-06-01`;

describe('evidence ranking', () => {
  it('classifies systematic/meta reviews as level-1', () => {
    const result = classifyEvidence({
      publicationTypes: ['Systematic Review'],
      title: 'Network meta-analysis of tendon repair outcomes',
      abstractText: 'Systematic review with pooled outcomes',
      publicationDate: '2025-01-01',
    });

    expect(result.evidenceLevel).toBe('level-1');
    expect(result.studyType).toMatch(/meta-analysis|systematic review/);
    // Level-1 base score is 1.0; recency bonus is capped at Math.min(1, 1.0 + bonus) = 1.0
    expect(result.evidenceScore).toBe(1);
  });

  it('classifies randomized trials and applies recency bonus', () => {
    const result = classifyEvidence({
      publicationTypes: ['Randomized Controlled Trial'],
      title: 'Randomized comparison of operative vs nonoperative care',
      abstractText: 'double blind placebo-controlled trial',
      publicationDate: '2024-06-10',
    });

    expect(result.evidenceLevel).toBe('level-2');
    expect(result.studyType).toBe('randomized controlled trial');
    // Base 0.85 + recency bonus (0.04 or 0.08 depending on current year); always > 0.85
    expect(result.evidenceScore).toBeGreaterThan(0.85);
  });

  it('applies +0.08 recency bonus for publications within 3 years', () => {
    const result = classifyEvidence({
      publicationTypes: ['Randomized Controlled Trial'],
      title: 'Recent RCT on shoulder repair',
      abstractText: 'randomized controlled trial',
      publicationDate: yearAgo(1), // always < 3 years old
    });

    expect(result.evidenceLevel).toBe('level-2');
    expect(result.evidenceScore).toBeCloseTo(0.93, 10); // 0.85 + 0.08 (float-safe)
  });

  it('applies +0.04 recency bonus for publications within 7 years but beyond 3', () => {
    const result = classifyEvidence({
      publicationTypes: ['Randomized Controlled Trial'],
      title: 'Older RCT on ACL reconstruction',
      abstractText: 'randomized controlled trial',
      publicationDate: yearAgo(5), // always 4–6 years old, within 7 but beyond 3
    });

    expect(result.evidenceLevel).toBe('level-2');
    expect(result.evidenceScore).toBeCloseTo(0.89, 10); // 0.85 + 0.04 (float-safe)
  });

  it('applies no recency bonus for publications older than 7 years', () => {
    const result = classifyEvidence({
      publicationTypes: ['Randomized Controlled Trial'],
      title: 'Historical RCT on fixation methods',
      abstractText: 'randomized controlled trial',
      publicationDate: yearAgo(9), // always > 7 years old
    });

    expect(result.evidenceLevel).toBe('level-2');
    expect(result.evidenceScore).toBe(0.85); // no bonus
  });

  it('classifies case series and narrative fallback levels', () => {
    const caseSeries = classifyEvidence({
      publicationTypes: ['Case Reports'],
      title: 'Case report of rare tendon rupture',
      abstractText: 'This case series explores outcomes',
      publicationDate: '2010-01-01',
    });

    expect(caseSeries.evidenceLevel).toBe('level-4');
    expect(caseSeries.evidenceScore).toBe(0.55);

    const narrative = classifyEvidence({
      publicationTypes: ['Editorial'],
      title: 'Expert perspective on rehabilitation',
      abstractText: 'opinion and narrative synthesis',
      publicationDate: null,
    });

    expect(narrative.evidenceLevel).toBe('level-5');
    expect(narrative.studyType).toContain('expert opinion');
  });

  it('falls back to level-5 when publicationTypes is empty', () => {
    const result = classifyEvidence({
      publicationTypes: [],
      title: 'Unknown source document',
      abstractText: 'Some content without clear study type',
      publicationDate: null,
    });

    expect(result.evidenceLevel).toBe('level-5');
  });

  it('maps all evidence level strings to correct ordinal ranks', () => {
    expect(evidenceLevelToOrdinal('level-1')).toBe(1);
    expect(evidenceLevelToOrdinal('level-2')).toBe(2);
    expect(evidenceLevelToOrdinal('level-3')).toBe(3);
    expect(evidenceLevelToOrdinal('level-4')).toBe(4);
    expect(evidenceLevelToOrdinal('level-5')).toBe(5);
    expect(evidenceLevelToOrdinal(null)).toBe(Number.POSITIVE_INFINITY);
  });
});
