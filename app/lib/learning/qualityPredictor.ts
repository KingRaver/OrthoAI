/**
 * Quality Prediction Model
 * Predicts response quality before generation using historical data
 * Helps with confidence scoring and model selection
 */

import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), '.data', 'quality_predictions.db');

export interface QualityPrediction {
  predictedQuality: number;
  confidence: number;
  factors: {
    themeMatch: number;
    complexityAlignment: number;
    modelHistory: number;
    parameterOptimality: number;
  };
  reasoning: string;
}

export interface HistoricalOutcome {
  theme: string;
  complexity: number;
  model: string;
  temperature: number;
  quality: number;
  userFeedback: string;
  timestamp: Date;
}

type DbQualityFeatureRow = {
  avg_quality: number | null;
  sample_count: number | null;
  success_rate: number | null;
};

type DbThemeModelStatsRow = {
  avg_quality: number | null;
  count: number | null;
};

type DbComplexityStatsRow = {
  avg_quality: number | null;
};

type DbAggregateRow = {
  avg_quality: number | null;
  sample_count: number | null;
  success_rate: number | null;
};

type DbQualityAnalyticsRow = {
  model: string;
  avg_quality: number | null;
  sample_count: number | null;
  success_rate: number | null;
};

export class QualityPredictor {
  private db!: sqlite3.Database;

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = sqlite3(DB_PATH);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quality_history (
        id TEXT PRIMARY KEY,
        theme TEXT NOT NULL,
        complexity INTEGER NOT NULL,
        model TEXT NOT NULL,
        temperature REAL NOT NULL,
        max_tokens INTEGER NOT NULL,
        tools_enabled BOOLEAN NOT NULL,
        quality_score REAL NOT NULL,
        user_feedback TEXT,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_theme_model ON quality_history(theme, model);
      CREATE INDEX IF NOT EXISTS idx_complexity ON quality_history(complexity);
      CREATE INDEX IF NOT EXISTS idx_quality ON quality_history(quality_score);

      CREATE TABLE IF NOT EXISTS quality_features (
        id TEXT PRIMARY KEY,
        theme TEXT NOT NULL,
        complexity_bucket INTEGER NOT NULL,
        model TEXT NOT NULL,
        avg_quality REAL NOT NULL,
        sample_count INTEGER NOT NULL,
        success_rate REAL NOT NULL,
        last_updated TEXT NOT NULL,
        UNIQUE(theme, complexity_bucket, model)
      );

      CREATE INDEX IF NOT EXISTS idx_features ON quality_features(theme, complexity_bucket, model);
    `);
  }

  /**
   * Predict quality for a given configuration
   */
  async predictQuality(
    theme: string,
    complexity: number,
    model: string,
    temperature: number,
    maxTokens: number,
    toolsEnabled: boolean
  ): Promise<QualityPrediction> {
    const complexityBucket = Math.floor(complexity / 34);

    // Get feature data for this configuration
    const features = await this.getFeatures(theme, complexityBucket, model);

    // Calculate prediction factors
    const modelHistory = features?.avg_quality ?? 0.75;
    const factors: QualityPrediction['factors'] = {
      themeMatch: await this.calculateThemeMatchScore(theme, model),
      complexityAlignment: await this.calculateComplexityScore(complexity, model),
      modelHistory,
      parameterOptimality: this.calculateParameterScore(
        temperature,
        complexity,
        theme,
        maxTokens,
        toolsEnabled
      )
    };

    // Weighted prediction
    const weights = {
      themeMatch: 0.25,
      complexityAlignment: 0.25,
      modelHistory: 0.35,
      parameterOptimality: 0.15
    };

    const predictedQuality =
      factors.themeMatch * weights.themeMatch +
      factors.complexityAlignment * weights.complexityAlignment +
      factors.modelHistory * weights.modelHistory +
      factors.parameterOptimality * weights.parameterOptimality;

    // Calculate confidence based on sample size and recency
    const sampleCount = features?.sample_count || 0;
    const confidence = Math.min(0.95, 0.3 + (sampleCount / 30));

    // Generate reasoning
    const reasoning = this.generateReasoning(factors, sampleCount, features);

    return {
      predictedQuality: Math.max(0.1, Math.min(1.0, predictedQuality)),
      confidence,
      factors,
      reasoning
    };
  }

  /**
   * Get stored feature data
   */
  private async getFeatures(
    theme: string,
    complexityBucket: number,
    model: string
  ): Promise<DbQualityFeatureRow | null> {
    const stmt = this.db.prepare(`
      SELECT avg_quality, sample_count, success_rate
      FROM quality_features
      WHERE theme = ? AND complexity_bucket = ? AND model = ?
    `);

    const row = stmt.get(theme, complexityBucket, model) as DbQualityFeatureRow | undefined;
    return row || null;
  }

  /**
   * Calculate theme-model match score
   */
  private async calculateThemeMatchScore(theme: string, model: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT AVG(quality_score) as avg_quality, COUNT(*) as count
      FROM quality_history
      WHERE theme = ? AND model = ?
      AND created_at >= datetime('now', '-30 days')
    `);

    const row = stmt.get(theme, model) as DbThemeModelStatsRow | undefined;

    if (row && (row.count ?? 0) >= 3) {
      return row.avg_quality ?? 0.75;
    }

    // Default scores based on known model strengths
    const modelStrengths: { [key: string]: { [key: string]: number } } = {
      'biomistral-7b': {
        'clinical-consult': 0.90,
        'surgical-planning': 0.88,
        'complications-risk': 0.87,
        'imaging-dx': 0.84,
        'rehab-rtp': 0.83,
        'evidence-brief': 0.89
      },
      'biogpt': {
        'clinical-consult': 0.72,
        'surgical-planning': 0.66,
        'complications-risk': 0.65,
        'imaging-dx': 0.74,
        'rehab-rtp': 0.68,
        'evidence-brief': 0.70
      }
    };

    const modelKey = Object.keys(modelStrengths).find(key => model.includes(key));
    if (modelKey && modelStrengths[modelKey][theme]) {
      return modelStrengths[modelKey][theme];
    }

    return 0.75; // Default baseline
  }

  /**
   * Calculate complexity alignment score
   */
  private async calculateComplexityScore(complexity: number, model: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT AVG(quality_score) as avg_quality
      FROM quality_history
      WHERE model = ?
      AND complexity BETWEEN ? AND ?
      AND created_at >= datetime('now', '-30 days')
    `);

    const row = stmt.get(model, complexity - 15, complexity + 15) as DbComplexityStatsRow | undefined;

    if (row && row.avg_quality !== null) {
      return row.avg_quality;
    }

    // Heuristic: larger models handle complexity better
    if (model.includes('biomistral')) {
      return complexity > 70 ? 0.90 : 0.86;
    } else if (model.includes('biogpt')) {
      return complexity > 70 ? 0.65 : 0.78;
    } else {
      return complexity > 70 ? 0.70 : 0.80;
    }
  }

  /**
   * Calculate parameter optimality score
   */
  private calculateParameterScore(
    temperature: number,
    complexity: number,
    theme: string,
    maxTokens: number,
    toolsEnabled: boolean
  ): number {
    // Ideal temperature ranges
    const creativeTasks: string[] = [];
    const preciseTasks = [
      'clinical-consult',
      'surgical-planning',
      'complications-risk',
      'imaging-dx',
      'evidence-brief'
    ];

    let idealTemp = 0.4;
    if (creativeTasks.includes(theme)) {
      idealTemp = 0.6;
    } else if (preciseTasks.includes(theme)) {
      idealTemp = 0.3;
    } else if (complexity > 70) {
      idealTemp = 0.5;
    }

    // Score based on distance from ideal
    const tempDiff = Math.abs(temperature - idealTemp);
    const tempScore = Math.max(0.5, 1.0 - (tempDiff / 0.5));

    // Token budget scoring (higher complexity needs more tokens)
    const idealTokens = Math.min(16000, Math.max(2000, 4000 + (complexity * 120)));
    const tokenDiffRatio = Math.min(1, Math.abs(maxTokens - idealTokens) / idealTokens);
    const tokenScore = Math.max(0.5, 1.0 - tokenDiffRatio);

    // Tools usage scoring (tools help for complex or high-risk themes)
    const toolPreferredThemes = [
      'surgical-planning',
      'complications-risk',
      'imaging-dx',
      'evidence-brief'
    ];
    const toolsRecommended = complexity >= 50 || toolPreferredThemes.includes(theme);
    const toolsScore = toolsEnabled === toolsRecommended ? 1.0 : 0.7;

    return (tempScore * 0.5) + (tokenScore * 0.3) + (toolsScore * 0.2);
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    factors: QualityPrediction['factors'],
    sampleCount: number,
    features: DbQualityFeatureRow | null
  ): string {
    const parts: string[] = [];

    if (sampleCount >= 10) {
      parts.push(`Strong historical data (${sampleCount} samples)`);
    } else if (sampleCount >= 3) {
      parts.push(`Moderate historical data (${sampleCount} samples)`);
    } else {
      parts.push('Limited historical data, using heuristics');
    }

    if (factors.themeMatch > 0.85) {
      parts.push('excellent theme match');
    } else if (factors.themeMatch > 0.75) {
      parts.push('good theme match');
    }

    if (factors.complexityAlignment > 0.85) {
      parts.push('well-suited for complexity');
    }

    if (features?.success_rate !== null && features?.success_rate !== undefined && features.success_rate > 0.85) {
      parts.push(`${(features.success_rate * 100).toFixed(0)}% success rate`);
    }

    return parts.join(', ');
  }

  /**
   * Record actual outcome for model training
   */
  async recordOutcome(
    theme: string,
    complexity: number,
    model: string,
    temperature: number,
    maxTokens: number,
    toolsEnabled: boolean,
    qualityScore: number,
    userFeedback?: string,
    responseTime?: number,
    tokensUsed?: number
  ): Promise<void> {
    // Record individual outcome
    const stmt = this.db.prepare(`
      INSERT INTO quality_history
      (id, theme, complexity, model, temperature, max_tokens, tools_enabled,
       quality_score, user_feedback, response_time_ms, tokens_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `outcome_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      theme,
      complexity,
      model,
      temperature,
      maxTokens,
      toolsEnabled ? 1 : 0,
      qualityScore,
      userFeedback || null,
      responseTime || null,
      tokensUsed || null,
      new Date().toISOString()
    );

    // Update feature aggregates
    await this.updateFeatures(theme, complexity, model);
  }

  /**
   * Update feature aggregates for predictions
   */
  private async updateFeatures(theme: string, complexity: number, model: string): Promise<void> {
    const complexityBucket = Math.floor(complexity / 34);
    const bucketMin = complexityBucket * 34;
    const bucketMax = (complexityBucket + 1) * 34;

    // Calculate aggregates
    const stmt = this.db.prepare(`
      SELECT
        AVG(quality_score) as avg_quality,
        COUNT(*) as sample_count,
        SUM(CASE WHEN quality_score >= 0.75 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
      FROM quality_history
      WHERE theme = ? AND complexity >= ? AND complexity < ? AND model = ?
      AND created_at >= datetime('now', '-90 days')
    `);

    const row = stmt.get(theme, bucketMin, bucketMax, model) as DbAggregateRow | undefined;

    if (row && (row.sample_count ?? 0) > 0) {
      const upsertStmt = this.db.prepare(`
        INSERT INTO quality_features
        (id, theme, complexity_bucket, model, avg_quality, sample_count, success_rate, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(theme, complexity_bucket, model) DO UPDATE SET
          avg_quality = ?,
          sample_count = ?,
          success_rate = ?,
          last_updated = ?
      `);

      const id = `feature_${theme}_${complexityBucket}_${model}`;
      const now = new Date().toISOString();
      const avgQuality = row.avg_quality ?? 0;
      const sampleCount = row.sample_count ?? 0;
      const successRate = row.success_rate ?? 0;

      upsertStmt.run(
        id, theme, complexityBucket, model,
        avgQuality, sampleCount, successRate, now,
        avgQuality, sampleCount, successRate, now
      );

      console.log(`[QualityPredictor] Updated features for ${theme}/${complexityBucket}/${model}: quality=${avgQuality.toFixed(2)}, samples=${sampleCount}`);
    }
  }

  /**
   * Get quality analytics
   */
  async getQualityAnalytics(): Promise<{
    model: string;
    avgQuality: number;
    sampleCount: number;
    successRate: number;
  }[]> {
    const stmt = this.db.prepare(`
      SELECT
        model,
        AVG(quality_score) as avg_quality,
        COUNT(*) as sample_count,
        SUM(CASE WHEN quality_score >= 0.75 THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as success_rate
      FROM quality_history
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY model
      ORDER BY avg_quality DESC
    `);

    const rows = stmt.all() as DbQualityAnalyticsRow[];

    return rows.map(row => ({
      model: row.model,
      avgQuality: row.avg_quality ?? 0,
      sampleCount: row.sample_count ?? 0,
      successRate: row.success_rate ?? 0
    }));
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(days = 180): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    this.db.exec(`DELETE FROM quality_history WHERE created_at < '${cutoff}'`);
    console.log(`[QualityPredictor] Cleaned up data older than ${days} days`);
  }
}

// Singleton instance
export const qualityPredictor = new QualityPredictor();
