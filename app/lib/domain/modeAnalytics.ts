// app/lib/domain/modeAnalytics.ts
import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

/**
 * Mode Analytics
 * Tracks performance of interaction modes (clinical-consult, surgical-planning, complications-risk, imaging-dx, rehab-rtp, evidence-brief, auto)
 * Separate from strategy analytics - these track the personality/system prompt performance
 *
 * KEY DESIGN:
 * - Mode interactions use IDs with 'mode_' prefix (e.g., mode_1234...)
 * - Stored in separate mode_analytics.db database
 * - Independent of strategy decisions (no foreign key relationships)
 * - Enables voting on ALL responses, even without Strategy enabled
 */

const DB_PATH = path.join(process.cwd(), '.data', 'mode_analytics.db');

export interface ModePerformance {
  mode: string;
  totalInteractions: number;
  averageQuality: number;
  userSatisfaction: number;
  successRate: number;
  feedbackBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    satisfactionTrend: number[];
  };
}

export class ModeAnalytics {
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

    // Create tables for mode tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mode_interactions (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        model_used TEXT,
        response_quality REAL,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        user_feedback TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mode_interactions_mode ON mode_interactions(mode);
      CREATE INDEX IF NOT EXISTS idx_mode_interactions_created ON mode_interactions(created_at);
    `);
  }

  async logInteraction(params: {
    id: string;
    mode: string;
    modelUsed: string;
    responseQuality: number;
    responseTime: number;
    tokensUsed: number;
    userFeedback?: 'positive' | 'negative' | 'neutral' | null;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO mode_interactions
      (id, mode, model_used, response_quality, response_time_ms, tokens_used, user_feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      params.id,
      params.mode,
      params.modelUsed,
      params.responseQuality,
      params.responseTime,
      params.tokensUsed,
      params.userFeedback || null,
      new Date().toISOString()
    ]);
  }

  async updateMetrics(id: string, responseTime: number, tokensUsed: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE mode_interactions
      SET response_time_ms = ?, tokens_used = ?
      WHERE id = ?
    `);

    stmt.run([responseTime, tokensUsed, id]);
  }

  async updateFeedback(id: string, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    const qualityScore = feedback === 'positive' ? 0.95 : feedback === 'negative' ? 0.3 : 0.7;

    const stmt = this.db.prepare(`
      UPDATE mode_interactions
      SET user_feedback = ?, response_quality = ?
      WHERE id = ?
    `);

    stmt.run([feedback, qualityScore, id]);
  }

  async getModePerformance(mode: string): Promise<ModePerformance> {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        AVG(response_quality) as avg_quality,
        AVG(CASE WHEN user_feedback = 'positive' THEN 1
                 WHEN user_feedback = 'negative' THEN 0
                 ELSE 0.5 END) as satisfaction,
        SUM(CASE WHEN user_feedback = 'positive' THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN user_feedback = 'negative' THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN user_feedback IS NULL OR user_feedback = 'neutral' THEN 1 ELSE 0 END) as neutral_count
      FROM mode_interactions
      WHERE mode = ?
    `);

    const row = stmt.get(mode) as any;

    // Get trend over last 10 interactions
    const trendStmt = this.db.prepare(`
      SELECT
        CASE WHEN user_feedback = 'positive' THEN 1
             WHEN user_feedback = 'negative' THEN 0
             ELSE 0.5 END as score
      FROM mode_interactions
      WHERE mode = ?
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const trendRows = trendStmt.all(mode) as any[];
    const satisfactionTrend = trendRows.map(r => r.score || 0.5).reverse();

    return {
      mode,
      totalInteractions: row.total || 0,
      averageQuality: row.avg_quality || 0.8,
      userSatisfaction: row.satisfaction || 0.8,
      successRate: row.avg_quality || 0.8,
      feedbackBreakdown: {
        positive: row.positive_count || 0,
        negative: row.negative_count || 0,
        neutral: row.neutral_count || 0,
        total: row.total || 0,
        satisfactionTrend
      }
    };
  }

  async getAllModesPerformance(): Promise<ModePerformance[]> {
    const modes = [
      'auto',
      'clinical-consult',
      'surgical-planning',
      'complications-risk',
      'imaging-dx',
      'rehab-rtp',
      'evidence-brief'
    ];
    return Promise.all(modes.map(mode => this.getModePerformance(mode)));
  }
}

// Singleton instance
export const modeAnalytics = new ModeAnalytics();
