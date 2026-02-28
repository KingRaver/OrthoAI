export const CLINICAL_BENCHMARK_VERSION = 'v1';

export const CLINICAL_RUBRIC_DIMENSIONS = [
  'diagnosticAccuracy',
  'workupSelection',
  'treatmentAppropriateness',
  'redFlagDetection',
  'examProtocolUsage',
  'imagingInterpretationGuidance',
  'rehabRtpGuidance',
  'clarityAndStructure',
] as const;

export type ClinicalRubricDimension = (typeof CLINICAL_RUBRIC_DIMENSIONS)[number];

export type ClinicalBenchmarkTarget = 'decision-support' | 'llm' | 'all';

export type ClinicalMode =
  | 'clinical-consult'
  | 'treatment-decision'
  | 'surgical-planning'
  | 'complications-risk'
  | 'imaging-dx'
  | 'rehab-rtp'
  | 'evidence-brief';

export interface ClinicalBenchmarkInput {
  complaint: string;
  history?: string;
  examFindings?: string[];
  age?: number;
  comorbidities?: string[];
  activityGoal?: string;
  procedure?: string;
  daysSinceInjury?: number;
}

export interface ClinicalBenchmarkExpected {
  primaryDiagnosis: string[];
  differential: string[];
  workup: string[];
  treatment: string[];
  redFlags: string[];
  rehabRtp: string[];
  examProtocol: string[];
  imaging: string[];
}

export interface ClinicalBenchmarkCase {
  id: string;
  title: string;
  llmMode?: ClinicalMode;
  input: ClinicalBenchmarkInput;
  expected: ClinicalBenchmarkExpected;
}

export interface ClinicalBenchmarkFixtureSet {
  version: string;
  cases: ClinicalBenchmarkCase[];
}

export interface ClinicalRubricThresholds {
  averageTarget: number;
  diagnosticMin: number;
  redFlagMin: number;
  requiredDimensionMin: number;
  requiredDimensions: ClinicalRubricDimension[];
}

export const CLINICAL_RUBRIC_THRESHOLDS: ClinicalRubricThresholds = {
  averageTarget: 3.0,
  diagnosticMin: 3.0,
  redFlagMin: 3.5,
  requiredDimensionMin: 3.0,
  requiredDimensions: [...CLINICAL_RUBRIC_DIMENSIONS],
};

export interface DimensionScore {
  dimension: ClinicalRubricDimension;
  score: number;
  passed: boolean;
  notes: string;
  matchedTerms: string[];
  missedTerms: string[];
}

export interface CaseScoreSummary {
  caseId: string;
  caseTitle: string;
  target: Exclude<ClinicalBenchmarkTarget, 'all'>;
  modeUsed?: ClinicalMode;
  modelUsed?: string;
  averageScore: number;
  passed: boolean;
  dimensions: Record<ClinicalRubricDimension, DimensionScore>;
  rawResponse: unknown;
}

export interface AggregateScoreSummary {
  totalCases: number;
  averageScore: number;
  perDimensionAverage: Record<ClinicalRubricDimension, number>;
  gate: GateEvaluation;
}

export interface GateEvaluation {
  passed: boolean;
  checks: Array<{
    id: string;
    passed: boolean;
    observed: number;
    expectedMin: number;
    notes: string;
  }>;
  failingChecks: string[];
}

export type ClinicianReviewSource =
  | 'clinician_primary'
  | 'clinician_secondary'
  | 'adjudicated';

export type AdjudicationStatus =
  | 'not_required'
  | 'pending'
  | 'agreed'
  | 'disputed'
  | 'resolved';

export interface ClinicianDimensionReview {
  score: number;
  rationale?: string;
}

export interface ClinicianReviewSubmission {
  target: Exclude<ClinicalBenchmarkTarget, 'all'>;
  caseId: string;
  reviewerId: string;
  source: ClinicianReviewSource;
  adjudicationStatus?: AdjudicationStatus;
  comments?: string;
  dimensions: Partial<Record<ClinicalRubricDimension, ClinicianDimensionReview>>;
}

export interface ClinicianAggregate {
  available: boolean;
  perDimensionAverage: Partial<Record<ClinicalRubricDimension, number>>;
  reviewCount: number;
  disagreementCount: number;
  adjudicationStatus: AdjudicationStatus;
}

export interface HybridCaseSummary {
  caseResult: CaseScoreSummary;
  clinician: ClinicianAggregate;
  autoVsClinicianDisagreementCount: number;
}
