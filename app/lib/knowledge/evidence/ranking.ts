import type { EvidenceLevel } from '../phase5Types';

export interface EvidenceClassification {
  studyType: string;
  evidenceLevel: EvidenceLevel;
  evidenceScore: number;
}

const EVIDENCE_LEVEL_SCORE: Record<EvidenceLevel, number> = {
  'level-1': 1,
  'level-2': 0.85,
  'level-3': 0.7,
  'level-4': 0.55,
  'level-5': 0.4,
};

function lower(values: string[]): string[] {
  return values.map(value => value.toLowerCase());
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some(needle => haystack.includes(needle));
}

function publicationDateBonus(publicationDate: string | null): number {
  if (!publicationDate) return 0;
  const date = new Date(publicationDate);
  if (Number.isNaN(date.getTime())) return 0;
  const ageYears = Math.max(0, (Date.now() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (ageYears <= 3) return 0.08;
  if (ageYears <= 7) return 0.04;
  return 0;
}

export function evidenceLevelToOrdinal(level: EvidenceLevel | null): number {
  if (!level) return Number.POSITIVE_INFINITY;
  return Number.parseInt(level.split('-')[1] || '99', 10);
}

export function classifyEvidence(params: {
  publicationTypes: string[];
  title: string;
  abstractText: string;
  publicationDate: string | null;
}): EvidenceClassification {
  const publicationTypes = lower(params.publicationTypes);
  const corpus = `${params.title}\n${params.abstractText}`.toLowerCase();

  const hasMeta = publicationTypes.some(type => type.includes('meta-analysis')) ||
    includesAny(corpus, ['meta-analysis', 'network meta-analysis']);
  const hasSystematicReview = publicationTypes.some(type => type.includes('systematic review')) ||
    includesAny(corpus, ['systematic review']);
  if (hasMeta || hasSystematicReview) {
    const evidenceLevel: EvidenceLevel = 'level-1';
    return {
      studyType: hasMeta ? 'meta-analysis' : 'systematic review',
      evidenceLevel,
      evidenceScore: Math.min(1, EVIDENCE_LEVEL_SCORE[evidenceLevel] + publicationDateBonus(params.publicationDate)),
    };
  }

  const hasRct = publicationTypes.some(type => type.includes('randomized controlled trial')) ||
    includesAny(corpus, ['randomized', 'randomised', 'double blind', 'placebo-controlled trial']);
  if (hasRct) {
    const evidenceLevel: EvidenceLevel = 'level-2';
    return {
      studyType: 'randomized controlled trial',
      evidenceLevel,
      evidenceScore: Math.min(1, EVIDENCE_LEVEL_SCORE[evidenceLevel] + publicationDateBonus(params.publicationDate)),
    };
  }

  const hasCohort = publicationTypes.some(type => type.includes('cohort')) ||
    includesAny(corpus, ['prospective cohort', 'retrospective cohort']);
  const hasCaseControl = publicationTypes.some(type => type.includes('case-control')) ||
    includesAny(corpus, ['case-control']);
  if (hasCohort || hasCaseControl) {
    const evidenceLevel: EvidenceLevel = 'level-3';
    return {
      studyType: hasCohort ? 'cohort study' : 'case-control study',
      evidenceLevel,
      evidenceScore: Math.min(1, EVIDENCE_LEVEL_SCORE[evidenceLevel] + publicationDateBonus(params.publicationDate)),
    };
  }

  const hasCaseSeries = includesAny(corpus, ['case series', 'case report']) ||
    publicationTypes.some(type => type.includes('case reports'));
  if (hasCaseSeries) {
    const evidenceLevel: EvidenceLevel = 'level-4';
    return {
      studyType: 'case series',
      evidenceLevel,
      evidenceScore: Math.min(1, EVIDENCE_LEVEL_SCORE[evidenceLevel] + publicationDateBonus(params.publicationDate)),
    };
  }

  const evidenceLevel: EvidenceLevel = 'level-5';
  return {
    studyType: 'expert opinion / narrative review',
    evidenceLevel,
    evidenceScore: Math.min(1, EVIDENCE_LEVEL_SCORE[evidenceLevel] + publicationDateBonus(params.publicationDate)),
  };
}
