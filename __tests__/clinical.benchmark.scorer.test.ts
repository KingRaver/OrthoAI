import fixturesData from '@/app/lib/benchmarks/clinicalReasoning/cases.v1.json';
import {
  aggregateClinicalBenchmarkScores,
  buildHybridCaseSummary,
  scoreClinicalBenchmarkCase,
} from '@/app/lib/benchmarks/clinicalReasoning/scorer';
import type {
  ClinicalBenchmarkFixtureSet,
  ClinicianReviewSubmission,
} from '@/app/lib/benchmarks/clinicalReasoning/types';
import { describe, expect, it } from 'vitest';

const fixtures = fixturesData as ClinicalBenchmarkFixtureSet;
const aclCase = fixtures.cases.find(item => item.id === 'case-01-acl-pivot-athlete');

if (!aclCase) {
  throw new Error('Expected ACL benchmark case fixture to exist');
}

const STRONG_RESPONSE = `
Assessment
Likely ACL rupture (anterior cruciate ligament tear) after pivot injury.

Ranked Differential
1. ACL rupture
2. Meniscal tear
3. MCL sprain

Workup
- Obtain knee radiographs and MRI.
- Document Lachman and pivot shift findings.

Treatment Plan
- Immediate orthopedic consultation.
- Discuss ACL reconstruction and bracing with shared decision-making.
- Begin structured rehabilitation.

Red Flags and Escalation
- Watch for neurovascular compromise, locked knee, and inability to bear weight.
- Escalate urgently if these occur.

Exam Protocol
- Assess effusion, range of motion, Lachman, and pivot shift.

Imaging Guidance
- Knee radiographs first, then MRI for ligament/meniscal pathology.

Rehab and Return-to-Play
- Early quadriceps activation and neuromuscular control.
- Return-to-sport testing before full clearance.
`;

const WEAK_RESPONSE = `
Assessment
Knee pain after sports injury.

Plan
Rest and ice.
`;

describe('clinical benchmark scorer', () => {
  it('awards high scores when expected benchmark concepts are covered', () => {
    const result = scoreClinicalBenchmarkCase(aclCase, STRONG_RESPONSE, {
      target: 'llm',
      modeUsed: 'clinical-consult',
      modelUsed: 'biomistral-7b-instruct',
    });

    expect(result.dimensions.diagnosticAccuracy.score).toBeGreaterThanOrEqual(3);
    expect(result.dimensions.redFlagDetection.score).toBeGreaterThanOrEqual(3);
    expect(result.dimensions.workupSelection.score).toBeGreaterThanOrEqual(3);
    expect(result.averageScore).toBeGreaterThanOrEqual(3);
  });

  it('fails the case when critical dimensions are missed', () => {
    const result = scoreClinicalBenchmarkCase(aclCase, WEAK_RESPONSE, {
      target: 'llm',
      modeUsed: 'clinical-consult',
    });

    expect(result.dimensions.redFlagDetection.score).toBe(0);
    expect(result.dimensions.diagnosticAccuracy.score).toBeLessThan(3);
    expect(result.passed).toBe(false);
  });

  it('enforces aggregate gate thresholds', () => {
    const strongA = scoreClinicalBenchmarkCase(aclCase, STRONG_RESPONSE, { target: 'llm' });
    const strongB = scoreClinicalBenchmarkCase(aclCase, STRONG_RESPONSE, { target: 'decision-support' });
    const weakA = scoreClinicalBenchmarkCase(aclCase, WEAK_RESPONSE, { target: 'llm' });
    const weakB = scoreClinicalBenchmarkCase(aclCase, WEAK_RESPONSE, { target: 'decision-support' });

    const passingAggregate = aggregateClinicalBenchmarkScores([strongA, strongB]);
    const failingAggregate = aggregateClinicalBenchmarkScores([weakA, weakB]);

    expect(passingAggregate.gate.passed).toBe(true);
    expect(failingAggregate.gate.passed).toBe(false);
    expect(failingAggregate.gate.failingChecks).toContain('red-flag-min');
    expect(failingAggregate.gate.failingChecks).toContain('diagnostic-min');
  });

  it('tracks clinician disagreement and adjudication workflow data', () => {
    const autoResult = scoreClinicalBenchmarkCase(aclCase, STRONG_RESPONSE, { target: 'llm' });

    const review: ClinicianReviewSubmission = {
      target: 'llm',
      caseId: aclCase.id,
      reviewerId: 'dr_primary',
      source: 'clinician_primary',
      comments: 'Conservative on diagnostic certainty',
      dimensions: {
        diagnosticAccuracy: {
          score: 1,
          rationale: 'Primary diagnosis was not justified with enough exam nuance.',
        },
      },
    };

    const hybrid = buildHybridCaseSummary(autoResult, [review]);

    expect(hybrid.clinician.available).toBe(true);
    expect(hybrid.clinician.adjudicationStatus).toBe('pending');
    expect(hybrid.autoVsClinicianDisagreementCount).toBeGreaterThanOrEqual(1);
  });
});
