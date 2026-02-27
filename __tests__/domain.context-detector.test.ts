import { describe, expect, it } from 'vitest';
import { ContextDetector } from '@/app/lib/domain/contextDetector';

describe('ContextDetector', () => {
  it('detects treatment-decision mode from conservative-vs-operative language', () => {
    const result = ContextDetector.detect(
      'Should I operate or treat conservatively? Please compare treatment options and indicate surgical candidacy.'
    );

    expect(result.mode).toBe('treatment-decision');
    expect(result.reasoning).toContain('Detected treatment-decision mode');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('detects imaging mode, file type, and mixed domain when multiple signals exist', () => {
    const result = ContextDetector.detect(
      'MRI T2 sequences show partial tendon tear; discuss operative repair versus rehab progression.',
      'ankle_scan_report.pdf'
    );

    expect(result.mode).toBe('imaging-dx');
    expect(result.fileType).toBe('paper');
    expect(result.domain).toBe('mixed');
    expect(result.detectedKeywords.length).toBeGreaterThan(0);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('returns safe defaults for empty input', () => {
    const result = ContextDetector.detect('   ');

    expect(result.mode).toBeNull();
    expect(result.fileType).toBe('unknown');
    expect(result.domain).toBeNull();
    expect(result.reasoning).toContain('Empty input');
  });

  it('detects protocol file type from content keywords', () => {
    const result = ContextDetector.detect(
      'This clinical trial protocol follows ICH E6 guidelines. Trial registration on clinicaltrials.gov.'
    );

    expect(result.fileType).toBe('protocol');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('detects dataset file type from content keywords', () => {
    const result = ContextDetector.detect(
      'Patient outcomes dataset from the registry. Export includes csv metadata fields.'
    );

    expect(result.fileType).toBe('dataset');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('produces enhanced detection with complexity signals', () => {
    const richInput = [
      'randomized double-blind placebo cohort case-control meta-analysis systematic review',
      'p-value confidence interval effect size hazard ratio odds ratio risk ratio',
      'biomechanics kinematics tendon ligament cartilage arthroscopy reconstruction repair graft',
      'MRI ultrasound CT radiograph ECM collagen inflammation angiogenesis tenocyte',
      'What surgical option is best? What imaging confirms failure? What rehab threshold defines return?',
    ].join('. ');

    const enhanced = ContextDetector.detectEnhanced(richInput, undefined, 7);

    expect(enhanced.complexityScore).toBeGreaterThan(60);
    expect(enhanced.complexity).toMatch(/moderate|complex/);
    expect(enhanced.complexitySignals.conversationDepth).toBe(7);
    expect(enhanced.complexitySignals.multiDomainDetected).toBe(true);
  });

  it('maps confidence buckets at exact boundary values', () => {
    // Exact boundary thresholds: ≥0.8 Very High, ≥0.6 High, ≥0.4 Moderate, <0.4 Low
    expect(ContextDetector.getConfidenceLevel(0.8)).toBe('Very High');
    expect(ContextDetector.getConfidenceLevel(0.9)).toBe('Very High');
    expect(ContextDetector.getConfidenceLevel(0.6)).toBe('High');
    expect(ContextDetector.getConfidenceLevel(0.7)).toBe('High');
    expect(ContextDetector.getConfidenceLevel(0.4)).toBe('Moderate');
    expect(ContextDetector.getConfidenceLevel(0.5)).toBe('Moderate');
    expect(ContextDetector.getConfidenceLevel(0.39)).toBe('Low');
    expect(ContextDetector.getConfidenceLevel(0.2)).toBe('Low');
    expect(ContextDetector.getConfidenceLevel(0.0)).toBe('Low');
  });

  it('handles unicode and emoji-heavy input without throwing', () => {
    const unicodeInput = '患者 💉🦴 MRI скан résultats αβγ ™®';
    const result = ContextDetector.detect(unicodeInput);

    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(['paper', 'protocol', 'imaging', 'dataset', 'unknown']).toContain(result.fileType);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
