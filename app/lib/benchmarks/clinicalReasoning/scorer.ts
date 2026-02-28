import {
  CLINICAL_RUBRIC_DIMENSIONS,
  CLINICAL_RUBRIC_THRESHOLDS,
  type AdjudicationStatus,
  type AggregateScoreSummary,
  type CaseScoreSummary,
  type ClinicianAggregate,
  type ClinicianReviewSubmission,
  type ClinicalBenchmarkCase,
  type ClinicalRubricDimension,
  type ClinicalRubricThresholds,
  type DimensionScore,
  type GateEvaluation,
  type HybridCaseSummary,
} from './types';

const SCORE_MIN = 0;
const SCORE_MAX = 4;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return SCORE_MIN;
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, value));
}

function roundToTenths(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function includesTerm(text: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return text.includes(normalizedTerm);
}

function collectText(value: unknown, parts: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    parts.push(value);
    return;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    parts.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, parts);
    return;
  }
  if (typeof value === 'object') {
    for (const val of Object.values(value as Record<string, unknown>)) {
      collectText(val, parts);
    }
  }
}

export function flattenResponseText(value: unknown): string {
  const parts: string[] = [];
  collectText(value, parts);
  return normalizeText(parts.join(' '));
}

function matchTerms(text: string, expectedTerms: string[]): { matched: string[]; missed: string[] } {
  const matched: string[] = [];
  const missed: string[] = [];
  const seen = new Set<string>();

  for (const term of expectedTerms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm || seen.has(normalizedTerm)) continue;
    seen.add(normalizedTerm);

    if (includesTerm(text, term)) {
      matched.push(term);
    } else {
      missed.push(term);
    }
  }

  return { matched, missed };
}

function scoreFromCoverage(matchCount: number, expectedCount: number): number {
  if (expectedCount === 0) return SCORE_MAX;
  if (matchCount === 0) return 0;

  const ratio = matchCount / expectedCount;
  if (ratio < 0.34) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.8) return 3;
  return 4;
}

function makeDimensionScore(
  dimension: ClinicalRubricDimension,
  score: number,
  notes: string,
  matchedTerms: string[],
  missedTerms: string[],
  thresholds: ClinicalRubricThresholds,
): DimensionScore {
  const clampedScore = clampScore(score);
  return {
    dimension,
    score: clampedScore,
    passed: clampedScore >= thresholds.requiredDimensionMin,
    notes,
    matchedTerms,
    missedTerms,
  };
}

function scoreCoverageDimension(
  dimension: ClinicalRubricDimension,
  text: string,
  expectedTerms: string[],
  thresholds: ClinicalRubricThresholds,
  notesPrefix: string,
): DimensionScore {
  const { matched, missed } = matchTerms(text, expectedTerms);
  const score = scoreFromCoverage(matched.length, expectedTerms.length);
  const notes = `${notesPrefix}: matched ${matched.length}/${expectedTerms.length} expected terms.`;
  return makeDimensionScore(dimension, score, notes, matched, missed, thresholds);
}

function scoreDiagnosticDimension(
  text: string,
  caseFixture: ClinicalBenchmarkCase,
  thresholds: ClinicalRubricThresholds,
): DimensionScore {
  const primary = matchTerms(text, caseFixture.expected.primaryDiagnosis);
  const differential = matchTerms(text, caseFixture.expected.differential);

  let score = 0;
  if (primary.matched.length === 0 && differential.matched.length === 0) {
    score = 0;
  } else if (primary.matched.length === 0) {
    score = 1;
  } else if (differential.matched.length === 0) {
    score = 2;
  } else {
    const diffRatio = differential.matched.length / Math.max(1, caseFixture.expected.differential.length);
    score = diffRatio >= 0.67 ? 4 : 3;
  }

  const notes = `Primary matched ${primary.matched.length}/${caseFixture.expected.primaryDiagnosis.length}; differential matched ${differential.matched.length}/${caseFixture.expected.differential.length}.`;
  return makeDimensionScore(
    'diagnosticAccuracy',
    score,
    notes,
    [...primary.matched, ...differential.matched],
    [...primary.missed, ...differential.missed],
    thresholds,
  );
}

function scoreClarityDimension(response: unknown, text: string, thresholds: ClinicalRubricThresholds): DimensionScore {
  const textLength = text.length;
  const raw = typeof response === 'string' ? response : JSON.stringify(response ?? {});

  let score = 0;
  if (textLength >= 40) score += 1;

  const hasStructuredHeadings =
    /(assessment|recommendation|reasoning|next steps|plan|differential)/i.test(raw);
  if (hasStructuredHeadings) score += 1;

  const hasListFormatting =
    /(^|\n)\s*[-*]\s+/m.test(raw) || /(^|\n)\s*\d+\.\s+/m.test(raw);
  if (hasListFormatting) score += 1;

  const paragraphCount = raw.split(/\n\s*\n/).filter(Boolean).length;
  const looksStructuredObject = typeof response === 'object' && response !== null && !Array.isArray(response);
  if (paragraphCount >= 2 || looksStructuredObject) score += 1;

  const notes = `Length=${textLength}, headings=${hasStructuredHeadings}, lists=${hasListFormatting}, structuredObject=${looksStructuredObject}.`;

  return makeDimensionScore('clarityAndStructure', score, notes, [], [], thresholds);
}

function evaluateCasePass(
  dimensions: Record<ClinicalRubricDimension, DimensionScore>,
  averageScore: number,
  thresholds: ClinicalRubricThresholds,
): boolean {
  const requiredDimensionsPass = thresholds.requiredDimensions.every(
    dimension => dimensions[dimension].score >= thresholds.requiredDimensionMin,
  );

  const diagnosticPass = dimensions.diagnosticAccuracy.score >= thresholds.diagnosticMin;
  const redFlagPass = dimensions.redFlagDetection.score >= thresholds.redFlagMin;
  const averagePass = averageScore >= thresholds.averageTarget;

  return requiredDimensionsPass && diagnosticPass && redFlagPass && averagePass;
}

export function scoreClinicalBenchmarkCase(
  caseFixture: ClinicalBenchmarkCase,
  response: unknown,
  options?: {
    thresholds?: ClinicalRubricThresholds;
    target?: 'decision-support' | 'llm';
    modeUsed?: string;
    modelUsed?: string;
  },
): CaseScoreSummary {
  const thresholds = options?.thresholds || CLINICAL_RUBRIC_THRESHOLDS;
  const text = flattenResponseText(response);

  const dimensions = {
    diagnosticAccuracy: scoreDiagnosticDimension(text, caseFixture, thresholds),
    workupSelection: scoreCoverageDimension(
      'workupSelection',
      text,
      caseFixture.expected.workup,
      thresholds,
      'Workup coverage',
    ),
    treatmentAppropriateness: scoreCoverageDimension(
      'treatmentAppropriateness',
      text,
      caseFixture.expected.treatment,
      thresholds,
      'Treatment coverage',
    ),
    redFlagDetection: scoreCoverageDimension(
      'redFlagDetection',
      text,
      caseFixture.expected.redFlags,
      thresholds,
      'Red flag coverage',
    ),
    examProtocolUsage: scoreCoverageDimension(
      'examProtocolUsage',
      text,
      caseFixture.expected.examProtocol,
      thresholds,
      'Exam protocol coverage',
    ),
    imagingInterpretationGuidance: scoreCoverageDimension(
      'imagingInterpretationGuidance',
      text,
      caseFixture.expected.imaging,
      thresholds,
      'Imaging guidance coverage',
    ),
    rehabRtpGuidance: scoreCoverageDimension(
      'rehabRtpGuidance',
      text,
      caseFixture.expected.rehabRtp,
      thresholds,
      'Rehab/RTP coverage',
    ),
    clarityAndStructure: scoreClarityDimension(response, text, thresholds),
  } satisfies Record<ClinicalRubricDimension, DimensionScore>;

  const rawAverage = CLINICAL_RUBRIC_DIMENSIONS.reduce((sum, dimension) => {
    return sum + dimensions[dimension].score;
  }, 0) / CLINICAL_RUBRIC_DIMENSIONS.length;

  const averageScore = roundToTenths(rawAverage);

  return {
    caseId: caseFixture.id,
    caseTitle: caseFixture.title,
    target: options?.target || 'llm',
    modeUsed: options?.modeUsed as CaseScoreSummary['modeUsed'],
    modelUsed: options?.modelUsed,
    averageScore,
    passed: evaluateCasePass(dimensions, averageScore, thresholds),
    dimensions,
    rawResponse: response,
  };
}

export function evaluateGate(
  perDimensionAverage: Record<ClinicalRubricDimension, number>,
  overallAverage: number,
  thresholds: ClinicalRubricThresholds = CLINICAL_RUBRIC_THRESHOLDS,
): GateEvaluation {
  const checks: GateEvaluation['checks'] = [
    {
      id: 'overall-average',
      observed: overallAverage,
      expectedMin: thresholds.averageTarget,
      passed: overallAverage >= thresholds.averageTarget,
      notes: 'Overall average score target.',
    },
    {
      id: 'diagnostic-min',
      observed: perDimensionAverage.diagnosticAccuracy,
      expectedMin: thresholds.diagnosticMin,
      passed: perDimensionAverage.diagnosticAccuracy >= thresholds.diagnosticMin,
      notes: 'Diagnostic accuracy minimum.',
    },
    {
      id: 'red-flag-min',
      observed: perDimensionAverage.redFlagDetection,
      expectedMin: thresholds.redFlagMin,
      passed: perDimensionAverage.redFlagDetection >= thresholds.redFlagMin,
      notes: 'Red flag detection hard safety minimum.',
    },
  ];

  for (const dimension of thresholds.requiredDimensions) {
    checks.push({
      id: `required-${dimension}`,
      observed: perDimensionAverage[dimension],
      expectedMin: thresholds.requiredDimensionMin,
      passed: perDimensionAverage[dimension] >= thresholds.requiredDimensionMin,
      notes: `Required dimension minimum for ${dimension}.`,
    });
  }

  const failingChecks = checks.filter(check => !check.passed).map(check => check.id);

  return {
    passed: failingChecks.length === 0,
    checks,
    failingChecks,
  };
}

export function aggregateClinicalBenchmarkScores(
  caseResults: CaseScoreSummary[],
  thresholds: ClinicalRubricThresholds = CLINICAL_RUBRIC_THRESHOLDS,
): AggregateScoreSummary {
  if (caseResults.length === 0) {
    const emptyPerDimension = Object.fromEntries(
      CLINICAL_RUBRIC_DIMENSIONS.map(dimension => [dimension, 0]),
    ) as Record<ClinicalRubricDimension, number>;

    return {
      totalCases: 0,
      averageScore: 0,
      perDimensionAverage: emptyPerDimension,
      gate: evaluateGate(emptyPerDimension, 0, thresholds),
    };
  }

  const perDimensionAverage = Object.fromEntries(
    CLINICAL_RUBRIC_DIMENSIONS.map(dimension => {
      const rawAverage =
        caseResults.reduce((sum, caseResult) => sum + caseResult.dimensions[dimension].score, 0) /
        caseResults.length;
      return [dimension, roundToTenths(rawAverage)];
    }),
  ) as Record<ClinicalRubricDimension, number>;

  const overallAverage = roundToTenths(
    caseResults.reduce((sum, caseResult) => sum + caseResult.averageScore, 0) / caseResults.length,
  );

  return {
    totalCases: caseResults.length,
    averageScore: overallAverage,
    perDimensionAverage,
    gate: evaluateGate(perDimensionAverage, overallAverage, thresholds),
  };
}

export function aggregateClinicianReviewsForCase(
  reviews: ClinicianReviewSubmission[],
): ClinicianAggregate {
  if (reviews.length === 0) {
    return {
      available: false,
      perDimensionAverage: {},
      reviewCount: 0,
      disagreementCount: 0,
      adjudicationStatus: 'not_required',
    };
  }

  const perDimensionAverage: Partial<Record<ClinicalRubricDimension, number>> = {};
  let disagreementCount = 0;

  for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
    const scores = reviews
      .map(review => review.dimensions[dimension]?.score)
      .filter((score): score is number => typeof score === 'number')
      .map(clampScore);

    if (scores.length === 0) continue;

    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    perDimensionAverage[dimension] = roundToTenths(avg);

    const max = Math.max(...scores);
    const min = Math.min(...scores);
    if (max - min >= 1) {
      disagreementCount += 1;
    }
  }

  let adjudicationStatus: AdjudicationStatus;
  if (reviews.some(review => review.source === 'adjudicated')) {
    adjudicationStatus = 'resolved';
  } else if (reviews.length === 1) {
    adjudicationStatus = 'pending';
  } else if (disagreementCount > 0) {
    adjudicationStatus = 'disputed';
  } else {
    adjudicationStatus = 'agreed';
  }

  return {
    available: true,
    perDimensionAverage,
    reviewCount: reviews.length,
    disagreementCount,
    adjudicationStatus,
  };
}

export function computeAutoVsClinicianDisagreementCount(
  caseResult: CaseScoreSummary,
  clinicianAggregate: ClinicianAggregate,
  disagreementThreshold = 1,
): number {
  if (!clinicianAggregate.available) return 0;

  let disagreements = 0;
  for (const dimension of CLINICAL_RUBRIC_DIMENSIONS) {
    const clinicianScore = clinicianAggregate.perDimensionAverage[dimension];
    if (typeof clinicianScore !== 'number') continue;
    const autoScore = caseResult.dimensions[dimension].score;
    if (Math.abs(clinicianScore - autoScore) >= disagreementThreshold) {
      disagreements += 1;
    }
  }

  return disagreements;
}

export function buildHybridCaseSummary(
  caseResult: CaseScoreSummary,
  reviews: ClinicianReviewSubmission[],
): HybridCaseSummary {
  const clinician = aggregateClinicianReviewsForCase(reviews);
  const autoVsClinicianDisagreementCount = computeAutoVsClinicianDisagreementCount(
    caseResult,
    clinician,
  );

  return {
    caseResult,
    clinician,
    autoVsClinicianDisagreementCount,
  };
}
