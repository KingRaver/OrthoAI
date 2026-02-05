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

export class ParameterTuner {
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
  }

  /**
   * Get optimal parameter recommendations based on learned data
   */
  async getRecommendation(
    theme: string,
    complexity: number
  ): Promise<TuningRecommendation> {
    // Bucket complexity into ranges (0-33, 34-66, 67-100)
    const complexityBucket = Math.floor(complexity / 34);

    // Try to get exact match first
    let profile = await this.getProfile(theme, complexityBucket);

    // If no exact match, try adjacent buckets
    if (!profile || profile.sampleSize < 3) {
      const adjacentProfiles = await Promise.all([
        this.getProfile(theme, Math.max(0, complexityBucket - 1)),
        this.getProfile(theme, Math.min(2, complexityBucket + 1))
      ]);

      // Use the profile with the most samples
      const bestProfile = adjacentProfiles
        .filter(p => p && p.sampleSize >= 3)
        .sort((a, b) => b!.sampleSize - a!.sampleSize)[0];

      if (bestProfile) {
        profile = bestProfile;
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

    const row = stmt.get(theme, complexityBucket) as any;

    if (!row) return null;

    return {
      theme: row.theme,
      complexity: row.complexity_bucket * 34 + 17, // midpoint of bucket
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
    const complexityBucket = Math.floor(complexity / 34);

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

    const bucketMin = complexityBucket * 34;
    const bucketMax = (complexityBucket + 1) * 34;
    const row = stmt.get(theme, bucketMin, bucketMax, theme, bucketMin, bucketMax) as any;

    if (row && row.count > 0) {
      // Calculate weighted optimal parameters (prefer higher quality results)
      const optimalStmt = this.db.prepare(`
        SELECT temperature, max_tokens, tools_enabled, quality_score
        FROM parameter_experiments
        WHERE theme = ? AND complexity >= ? AND complexity < ?
        ORDER BY quality_score DESC
        LIMIT 5
      `);

      const topResults = optimalStmt.all(theme, bucketMin, bucketMax) as any[];

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

        upsertStmt.run(
          profileId,
          theme,
          complexityBucket,
          optimalTemp,
          optimalTokens,
          row.common_tools || 0,
          row.avg_quality,
          row.count,
          now,
          optimalTemp,
          optimalTokens,
          row.common_tools || 0,
          row.avg_quality,
          row.count,
          now
        );

        console.log(`[Tuner] Updated profile for ${theme}/${complexityBucket}: temp=${optimalTemp.toFixed(2)}, tokens=${optimalTokens}, samples=${row.count}`);
      }
    }
  }

  /**
   * Get default heuristic-based recommendations
   */
  private getDefaultRecommendation(theme: string, complexity: number): TuningRecommendation {
    // Creative tasks benefit from higher temperature
    const creativeTasks = ['architecture', 'refactoring', 'documentation'];
    const isCreative = creativeTasks.includes(theme);

    // Complex tasks need more tokens
    const baseTokens = 8000;
    const complexityMultiplier = 1 + (complexity / 200);
    const maxTokens = Math.round(baseTokens * complexityMultiplier);

    // Enable tools for moderate to high complexity
    const enableTools = complexity > 50;

    return {
      temperature: isCreative ? 0.6 : (complexity > 70 ? 0.5 : 0.3),
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

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      theme: row.theme,
      avgTemperature: row.avg_temperature,
      avgQuality: row.avg_quality,
      sampleSize: row.sample_size
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
