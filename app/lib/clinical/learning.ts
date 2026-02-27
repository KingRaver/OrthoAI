import { createHash } from 'crypto';
import { getStorage } from '@/app/lib/memory';

type CorrectionRow = {
  id: string;
  case_id: string;
  source_message: string;
  corrected_recommendation: string;
  subspecialty: string | null;
  diagnosis_tag: string | null;
  created_at: string;
};

type ExperimentRow = {
  id: string;
  case_id: string;
  strategy_variant: string;
  response_quality: number | null;
  user_feedback: string | null;
  created_at: string;
};

type CaseTagRow = {
  id: string;
  tags: string | null;
};

export interface LearningCorrectionInput {
  caseId: string;
  sourceMessage: string;
  correctedRecommendation: string;
  subspecialty?: string | null;
  diagnosisTag?: string | null;
}

export interface ExperimentInput {
  caseId: string;
  strategyVariant: 'variant_a' | 'variant_b';
  responseQuality?: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
}

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export class ClinicalLearningManager {
  private db = getStorage().getDatabase();

  listCorrections(caseId: string, limit = 50): CorrectionRow[] {
    return this.db.prepare(`
      SELECT * FROM clinical_learning_corrections
      WHERE case_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(caseId, Math.max(1, Math.min(500, limit))) as CorrectionRow[];
  }

  addCorrection(input: LearningCorrectionInput): CorrectionRow {
    const id = generateId('corr');
    this.db.prepare(`
      INSERT INTO clinical_learning_corrections
      (id, case_id, source_message, corrected_recommendation, subspecialty, diagnosis_tag, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.caseId,
      input.sourceMessage,
      input.correctedRecommendation,
      input.subspecialty || null,
      input.diagnosisTag || null,
      new Date().toISOString()
    );

    return this.db.prepare(`SELECT * FROM clinical_learning_corrections WHERE id = ?`).get(id) as CorrectionRow;
  }

  addExperiment(input: ExperimentInput): ExperimentRow {
    const id = generateId('exp');
    this.db.prepare(`
      INSERT INTO clinical_ab_experiments
      (id, case_id, strategy_variant, response_quality, user_feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.caseId,
      input.strategyVariant,
      input.responseQuality ?? null,
      input.userFeedback ?? null,
      new Date().toISOString()
    );

    return this.db.prepare(`SELECT * FROM clinical_ab_experiments WHERE id = ?`).get(id) as ExperimentRow;
  }

  listExperiments(caseId: string, limit = 100): ExperimentRow[] {
    return this.db.prepare(`
      SELECT * FROM clinical_ab_experiments
      WHERE case_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(caseId, Math.max(1, Math.min(500, limit))) as ExperimentRow[];
  }

  getCaseLearningSummary(caseId: string): {
    correctionCount: number;
    preferredVariant: 'variant_a' | 'variant_b';
    averageQualityByVariant: Record<string, number>;
    topSubspecialtyCorrections: Array<{ subspecialty: string; count: number }>;
  } {
    const correctionCount = (this.db.prepare(`
      SELECT COUNT(*) as count FROM clinical_learning_corrections WHERE case_id = ?
    `).get(caseId) as { count: number }).count;

    const variantRows = this.db.prepare(`
      SELECT strategy_variant, AVG(COALESCE(response_quality, 0.7)) as avg_quality
      FROM clinical_ab_experiments
      WHERE case_id = ?
      GROUP BY strategy_variant
    `).all(caseId) as Array<{ strategy_variant: string; avg_quality: number | null }>;

    const averageQualityByVariant = variantRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.strategy_variant] = row.avg_quality ?? 0.7;
      return acc;
    }, {});

    const preferredVariant: 'variant_a' | 'variant_b' =
      (averageQualityByVariant['variant_b'] || 0) > (averageQualityByVariant['variant_a'] || 0)
        ? 'variant_b'
        : 'variant_a';

    const topSubspecialtyCorrections = this.db.prepare(`
      SELECT COALESCE(subspecialty, 'general') as subspecialty, COUNT(*) as count
      FROM clinical_learning_corrections
      WHERE case_id = ?
      GROUP BY COALESCE(subspecialty, 'general')
      ORDER BY count DESC
      LIMIT 5
    `).all(caseId) as Array<{ subspecialty: string; count: number }>;

    return {
      correctionCount,
      preferredVariant,
      averageQualityByVariant,
      topSubspecialtyCorrections,
    };
  }

  getCrossCasePatterns(limit = 10): Array<{
    pattern: string;
    count: number;
    confidence: number;
  }> {
    const rows = this.db.prepare(`
      SELECT id, tags
      FROM patient_cases
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(Math.max(10, limit * 5)) as CaseTagRow[];

    const counts = new Map<string, number>();
    for (const row of rows) {
      const tags = parseStringArray(row.tags).map(tag => tag.toLowerCase());
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    const total = rows.length || 1;
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, Math.max(1, limit))
      .map(([pattern, count]) => ({
        pattern,
        count,
        confidence: Math.min(0.98, count / total + 0.2),
      }));
  }

  getUserPreferenceProfile(): {
    conservativeLean: number;
    surgicalLean: number;
    evidenceLean: number;
  } {
    const corrections = this.db.prepare(`
      SELECT corrected_recommendation
      FROM clinical_learning_corrections
      ORDER BY created_at DESC
      LIMIT 500
    `).all() as Array<{ corrected_recommendation: string }>;

    if (corrections.length === 0) {
      return {
        conservativeLean: 0.5,
        surgicalLean: 0.5,
        evidenceLean: 0.5,
      };
    }

    let conservative = 0;
    let surgical = 0;
    let evidence = 0;

    for (const item of corrections) {
      const text = item.corrected_recommendation.toLowerCase();
      if (text.includes('conservative') || text.includes('rehab') || text.includes('nonoperative')) conservative += 1;
      if (text.includes('surgery') || text.includes('operative') || text.includes('arthro')) surgical += 1;
      if (text.includes('evidence') || text.includes('guideline') || text.includes('study')) evidence += 1;
    }

    const total = corrections.length;
    return {
      conservativeLean: Math.round((conservative / total) * 1000) / 1000,
      surgicalLean: Math.round((surgical / total) * 1000) / 1000,
      evidenceLean: Math.round((evidence / total) * 1000) / 1000,
    };
  }
}

let sharedClinicalLearningManager: ClinicalLearningManager | null = null;

export function getClinicalLearningManager(): ClinicalLearningManager {
  if (!sharedClinicalLearningManager) {
    sharedClinicalLearningManager = new ClinicalLearningManager();
  }
  return sharedClinicalLearningManager;
}

