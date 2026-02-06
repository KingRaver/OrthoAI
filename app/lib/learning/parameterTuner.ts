/**
 * Dynamic Parameter Tuning System
 * Learns optimal temperature, token limits, and other parameters
 * based on continuous feedback from user interactions
 */

import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), '.data', 'parameter_tuning.db');

export interface ParameterProfile {
  theme: string;
  complexity: number;
  complexityBucket: number;
  optimalTemperature: number;
  optimalMaxTokens: number;
  enableTools: boolean;
  avgQuality: number;
  sampleSize: number;
  lastUpdated: Date;
}

export interface TuningRecommendation {
  temperature: number;
  maxTokens: number;
  enableTools: boolean;
  confidence: number;
  reasoning: string;
}

type DbProfileRow = {
  id: string;
  theme: string;
  complexity_bucket: number;
  optimal_temperature: number;
  optimal_max_tokens: number;
  enable_tools: number | null;
  avg_quality: number;
  sample_size: number;
  last_updated: string;
};

type DbProfileAggregateRow = {
  avg_temp: number | null;
  avg_tokens: number | null;
  avg_quality: number | null;
  count: number | null;
  common_tools: number | null;
};

type DbTopExperimentRow = {
  temperature: number;
  max_tokens: number;
  tools_enabled: number;
  quality_score: number;
};

type DbAnalyticsRow = {
  theme: string;
  avg_temperature: number | null;
  avg_quality: number | null;
  sample_size: number | null;
};

export class ParameterTuner {
  private db!: sqlite3.Database;
  private static BUCKET_COUNT = 10;
  private static BUCKET_SIZE = 10;

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
      CREATE TABLE IF NOT EXISTS parameter_profiles (
        id TEXT PRIMARY KEY,
        theme TEXT NOT NULL,
        complexity_bucket INTEGER NOT NULL,
        optimal_temperature REAL NOT NULL,
        optimal_max_tokens INTEGER NOT NULL,
        enable_tools BOOLEAN NOT NULL,
        avg_quality REAL NOT NULL,
        sample_size INTEGER NOT NULL,
        last_updated TEXT NOT NULL,
        UNIQUE(theme, complexity_bucket)
      );

      CREATE INDEX IF NOT EXISTS idx_theme_complexity ON parameter_profiles(theme, complexity_bucket);

      CREATE TABLE IF NOT EXISTS parameter_experiments (
        id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        theme TEXT NOT NULL,
        complexity INTEGER NOT NULL,
        temperature REAL NOT NULL,
        max_tokens INTEGER NOT NULL,
        tools_enabled BOOLEAN NOT NULL,
        quality_score REAL NOT NULL,
        user_feedback TEXT,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_experiments_theme ON parameter_experiments(theme);
      CREATE INDEX IF NOT EXISTS idx_experiments_decision ON parameter_experiments(decision_id);
    `);

    const legacyStats = this.db.prepare(`
      SELECT COUNT(*) as count, MAX(complexity_bucket) as max_bucket
      FROM parameter_profiles
    `).get() as { count: number; max_bucket: number | null };

    if (legacyStats.count > 0 && (legacyStats.max_bucket ?? 0) <= 2) {
      const mapping = [1, 5, 8];
      const rows = this.db.prepare(`SELECT id, theme, complexity_bucket FROM parameter_profiles`).all() as Array<{
        id: string;
        theme: string;
        complexity_bucket: number;
      }>;
      const updateStmt = this.db.prepare(`
        UPDATE parameter_profiles
        SET id = ?, complexity_bucket = ?
        WHERE id = ?
      `);
      rows.forEach(row => {
        const mappedBucket = mapping[row.complexity_bucket] ?? row.complexity_bucket;
        const newId = `profile_${row.theme}_${mappedBucket}`;
        updateStmt.run(newId, mappedBucket, row.id);
      });
      console.log('[Tuner] Migrated legacy 3-bucket profiles to 10-bucket layout');
    }
  }

  /**
   * Get optimal parameter recommendations based on learned data
   */
  async getRecommendation(
    theme: string,
    complexity: number
  ): Promise<TuningRecommendation> {
    const complexityBucket = this.getComplexityBucket(complexity);

    // Try to get exact match first
    const profile = await this.getProfile(theme, complexityBucket);

    // If no exact match, try adjacent buckets
    if (!profile || profile.sampleSize < 3) {
      const interpolated = await this.interpolateProfiles(theme, complexityBucket, complexity);
      if (interpolated) {
        return interpolated;
      }
    }

    // If we have learned data, use it
    if (profile && profile.sampleSize >= 3) {
      return {
        temperature: profile.optimalTemperature,
        maxTokens: profile.optimalMaxTokens,
        enableTools: profile.enableTools,
        confidence: Math.min(0.95, 0.5 + (profile.sampleSize / 20)),
        reasoning: `Learned from ${profile.sampleSize} samples (avg quality: ${profile.avgQuality.toFixed(2)})`
      };
    }

    // Otherwise return heuristic-based defaults
    return this.getDefaultRecommendation(theme, complexity);
  }

  /**
   * Get stored parameter profile
   */
  private async getProfile(
    theme: string,
    complexityBucket: number
  ): Promise<ParameterProfile | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM parameter_profiles
      WHERE theme = ? AND complexity_bucket = ?
    `);

    const row = stmt.get(theme, complexityBucket) as DbProfileRow | undefined;

    if (!row) return null;

    const midpoint = this.getBucketMidpoint(complexityBucket);
    return {
      theme: row.theme,
      complexity: midpoint,
      complexityBucket: row.complexity_bucket,
      optimalTemperature: row.optimal_temperature,
      optimalMaxTokens: row.optimal_max_tokens,
      enableTools: Boolean(row.enable_tools),
      avgQuality: row.avg_quality,
      sampleSize: row.sample_size,
      lastUpdated: new Date(row.last_updated)
    };
  }

  /**
   * Record experimental result for learning
   */
  async recordExperiment(
    decisionId: string,
    theme: string,
    complexity: number,
    temperature: number,
    maxTokens: number,
    toolsEnabled: boolean,
    qualityScore: number,
    userFeedback?: 'positive' | 'negative' | 'neutral',
    responseTime?: number,
    tokensUsed?: number
  ): Promise<void> {
    // Record the experiment
    const stmt = this.db.prepare(`
      INSERT INTO parameter_experiments
      (id, decision_id, theme, complexity, temperature, max_tokens, tools_enabled,
       quality_score, user_feedback, response_time_ms, tokens_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `exp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      decisionId,
      theme,
      complexity,
      temperature,
      maxTokens,
      toolsEnabled ? 1 : 0,
      qualityScore,
      userFeedback || null,
      responseTime || null,
      tokensUsed || null,
      new Date().toISOString()
    );

    // Update profile with new data
    await this.updateProfile(theme, complexity);
  }

  /**
   * Update parameter profile based on accumulated experiments
   */
  private async updateProfile(theme: string, complexity: number): Promise<void> {
    const complexityBucket = this.getComplexityBucket(complexity);

    // Get all experiments for this theme/complexity bucket
    const stmt = this.db.prepare(`
      SELECT
        AVG(temperature) as avg_temp,
        AVG(max_tokens) as avg_tokens,
        AVG(quality_score) as avg_quality,
        COUNT(*) as count,
        -- Find most common tools_enabled setting
        (SELECT tools_enabled FROM parameter_experiments
         WHERE theme = ? AND complexity >= ? AND complexity < ?
         GROUP BY tools_enabled
         ORDER BY COUNT(*) DESC LIMIT 1) as common_tools
      FROM parameter_experiments
      WHERE theme = ? AND complexity >= ? AND complexity < ?
    `);

    const { bucketMin, bucketMax } = this.getBucketRange(complexityBucket);
    const row = stmt.get(
      theme,
      bucketMin,
      bucketMax,
      theme,
      bucketMin,
      bucketMax
    ) as DbProfileAggregateRow | undefined;

    const sampleCount = row?.count ?? 0;
    if (row && sampleCount > 0) {
      // Calculate weighted optimal parameters (prefer higher quality results)
      const optimalStmt = this.db.prepare(`
        SELECT temperature, max_tokens, tools_enabled, quality_score
        FROM parameter_experiments
        WHERE theme = ? AND complexity >= ? AND complexity < ?
        ORDER BY quality_score DESC
        LIMIT 5
      `);

      const topResults = optimalStmt.all(theme, bucketMin, bucketMax) as DbTopExperimentRow[];

      if (topResults.length > 0) {
        // Weight by quality score
        const totalWeight = topResults.reduce((sum, r) => sum + r.quality_score, 0);
        const optimalTemp = topResults.reduce((sum, r) =>
          sum + (r.temperature * r.quality_score / totalWeight), 0
        );
        const optimalTokens = Math.round(topResults.reduce((sum, r) =>
          sum + (r.max_tokens * r.quality_score / totalWeight), 0
        ));

        // Upsert profile
        const upsertStmt = this.db.prepare(`
          INSERT INTO parameter_profiles
          (id, theme, complexity_bucket, optimal_temperature, optimal_max_tokens,
           enable_tools, avg_quality, sample_size, last_updated)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(theme, complexity_bucket) DO UPDATE SET
            optimal_temperature = ?,
            optimal_max_tokens = ?,
            enable_tools = ?,
            avg_quality = ?,
            sample_size = ?,
            last_updated = ?
        `);

        const now = new Date().toISOString();
        const profileId = `profile_${theme}_${complexityBucket}`;
        const commonTools = row.common_tools ?? 0;
        const avgQuality = row.avg_quality ?? 0;

        upsertStmt.run(
          profileId,
          theme,
          complexityBucket,
          optimalTemp,
          optimalTokens,
          commonTools,
          avgQuality,
          sampleCount,
          now,
          optimalTemp,
          optimalTokens,
          commonTools,
          avgQuality,
          sampleCount,
          now
        );

        console.log(`[Tuner] Updated profile for ${theme}/${complexityBucket}: temp=${optimalTemp.toFixed(2)}, tokens=${optimalTokens}, samples=${sampleCount}`);
      }
    }
  }

  private getComplexityBucket(complexity: number): number {
    const bucket = Math.floor(complexity / ParameterTuner.BUCKET_SIZE);
    return Math.min(ParameterTuner.BUCKET_COUNT - 1, Math.max(0, bucket));
  }

  private getBucketRange(bucket: number): { bucketMin: number; bucketMax: number } {
    const bucketMin = bucket * ParameterTuner.BUCKET_SIZE;
    const bucketMax = bucket === ParameterTuner.BUCKET_COUNT - 1
      ? 101
      : bucketMin + ParameterTuner.BUCKET_SIZE;
    return { bucketMin, bucketMax };
  }

  private getBucketMidpoint(bucket: number): number {
    const { bucketMin, bucketMax } = this.getBucketRange(bucket);
    return Math.round((bucketMin + bucketMax - 1) / 2);
  }

  private async interpolateProfiles(
    theme: string,
    targetBucket: number,
    complexity: number
  ): Promise<TuningRecommendation | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM parameter_profiles
      WHERE theme = ?
    `);
    const rows = stmt.all(theme) as DbProfileRow[];
    if (rows.length === 0) return null;

    const profiles = rows.map(row => ({
      theme: row.theme,
      complexity: this.getBucketMidpoint(row.complexity_bucket),
      complexityBucket: row.complexity_bucket,
      optimalTemperature: row.optimal_temperature,
      optimalMaxTokens: row.optimal_max_tokens,
      enableTools: Boolean(row.enable_tools),
      avgQuality: row.avg_quality,
      sampleSize: row.sample_size,
      lastUpdated: new Date(row.last_updated)
    })) as ParameterProfile[];

    const weightedProfiles = profiles
      .map(profile => {
        const distance = Math.abs(profile.complexityBucket - targetBucket);
        const distanceWeight = 1 / (1 + distance);
        const sampleWeight = Math.min(1, profile.sampleSize / 10);
        const qualityWeight = Math.max(0.5, profile.avgQuality);
        const weight = distanceWeight * sampleWeight * qualityWeight;
        return { profile, weight };
      })
      .filter(entry => entry.weight > 0);

    const totalWeight = weightedProfiles.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight === 0) return null;

    const temperature = weightedProfiles.reduce(
      (sum, entry) => sum + entry.profile.optimalTemperature * entry.weight,
      0
    ) / totalWeight;

    const maxTokens = Math.round(weightedProfiles.reduce(
      (sum, entry) => sum + entry.profile.optimalMaxTokens * entry.weight,
      0
    ) / totalWeight);

    const enableTools = weightedProfiles.reduce(
      (sum, entry) => sum + (entry.profile.enableTools ? 1 : 0) * entry.weight,
      0
    ) / totalWeight >= 0.5;

    const confidence = Math.min(0.85, 0.4 + totalWeight / 10);

    return {
      temperature,
      maxTokens: Math.min(16000, maxTokens),
      enableTools,
      confidence,
      reasoning: `Interpolated from ${weightedProfiles.length} nearby buckets for ${theme} (complexity ${complexity})`
    };
  }

  /**
   * Get default heuristic-based recommendations
   */
  private getDefaultRecommendation(theme: string, complexity: number): TuningRecommendation {
    const lowTempThemes = [
      'clinical-consult',
      'surgical-planning',
      'complications-risk',
      'imaging-dx',
      'evidence-brief'
    ];
    const midTempThemes = ['rehab-rtp'];

    const isLowTemp = lowTempThemes.includes(theme);
    const isMidTemp = midTempThemes.includes(theme);

    // Complex tasks need more tokens
    const baseTokens = 8000;
    const complexityMultiplier = 1 + (complexity / 200);
    const maxTokens = Math.round(baseTokens * complexityMultiplier);

    // Enable tools for moderate to high complexity
    const enableTools = complexity > 50;

    const temperature = isLowTemp
      ? 0.3
      : isMidTemp
        ? 0.35
        : (complexity > 70 ? 0.5 : 0.4);

    return {
      temperature,
      maxTokens: Math.min(16000, maxTokens),
      enableTools,
      confidence: 0.5, // Low confidence for defaults
      reasoning: 'Using heuristic defaults (not enough learned data yet)'
    };
  }

  /**
   * Get analytics on parameter effectiveness
   */
  async getParameterAnalytics(): Promise<{
    theme: string;
    avgTemperature: number;
    avgQuality: number;
    sampleSize: number;
  }[]> {
    const stmt = this.db.prepare(`
      SELECT
        theme,
        AVG(temperature) as avg_temperature,
        AVG(quality_score) as avg_quality,
        COUNT(*) as sample_size
      FROM parameter_experiments
      GROUP BY theme
      ORDER BY sample_size DESC
    `);

    const rows = stmt.all() as DbAnalyticsRow[];

    return rows.map(row => ({
      theme: row.theme,
      avgTemperature: row.avg_temperature ?? 0,
      avgQuality: row.avg_quality ?? 0,
      sampleSize: row.sample_size ?? 0
    }));
  }

  /**
   * Clean up old experiments
   */
  async cleanupOldData(days = 90): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    this.db.exec(`DELETE FROM parameter_experiments WHERE created_at < '${cutoff}'`);
    console.log(`[Tuner] Cleaned up experiments older than ${days} days`);
  }
}

// Singleton instance
export const parameterTuner = new ParameterTuner();
