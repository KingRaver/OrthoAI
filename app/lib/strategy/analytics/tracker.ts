// app/lib/strategy/analytics/tracker.ts
import { StrategyDecision, StrategyOutcome, PerformanceMetrics, ModelMetrics } from '../types';
import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

type StrategyPerformanceRow = {
  total_decisions: number | null;
  avg_quality: number | null;
  avg_time: number | null;
  avg_tokens: number | null;
  satisfaction: number | null;
  positive_count: number | null;
  negative_count: number | null;
  neutral_count: number | null;
};

type FeedbackBreakdownRow = {
  positive: number | null;
  negative: number | null;
  neutral: number | null;
  total: number | null;
};

type SatisfactionTrendRow = {
  score: number | null;
};

/**
 * Strategy Analytics
 * Logs decisions and outcomes for performance tracking
 */

const DB_PATH = path.join(process.cwd(), '.data', 'strategy_analytics.db');
const STRATEGY_ANALYTICS_RETENTION_DAYS = 90;

export class StrategyAnalytics {
  private db!: sqlite3.Database; // Using definite assignment assertion

  constructor() {
    this.initDatabase();
  }

  private initDatabase() {
    // Ensure the data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = sqlite3(DB_PATH);
    
    // Create tables (from migration)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS strategy_decisions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        strategy_name TEXT NOT NULL,
        selected_model TEXT NOT NULL,
        reasoning TEXT,
        confidence REAL,
        complexity_score INTEGER,
        decision_time_ms INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS strategy_outcomes (
        id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        response_quality REAL,
        response_time_ms INTEGER,
        tokens_used INTEGER,
        error_occurred BOOLEAN,
        retry_count INTEGER,
        user_feedback TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (decision_id) REFERENCES strategy_decisions(id)
      );
    `);

    // Always-on cleanup (no toggle)
    void this.cleanupOldData(STRATEGY_ANALYTICS_RETENTION_DAYS);
  }

  async logDecision(decision: StrategyDecision): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO strategy_decisions 
      (id, strategy_name, selected_model, reasoning, confidence, complexity_score, 
       decision_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const decisionId = decision.id;
    stmt.run([
      decisionId,
      decision.strategyName,
      decision.selectedModel,
      decision.reasoning,
      decision.confidence,
      decision.complexityScore,
      Date.now() - decision.timestamp.getTime(),
      decision.timestamp.toISOString()
    ]);

    void this.cleanupOldData(STRATEGY_ANALYTICS_RETENTION_DAYS);
    return decisionId;
  }

  async logOutcome(decisionId: string, outcome: StrategyOutcome): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO strategy_outcomes 
      (id, decision_id, response_quality, response_time_ms, tokens_used, 
       error_occurred, retry_count, user_feedback, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      `outcome_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      decisionId,
      outcome.responseQuality || 0.8,
      outcome.responseTime,
      outcome.tokensUsed,
      outcome.errorOccurred ? 1 : 0,
      outcome.retryCount || 0,
      outcome.userFeedback || null,
      new Date().toISOString()
    ]);

    void this.cleanupOldData(STRATEGY_ANALYTICS_RETENTION_DAYS);
  }

  async getStrategyPerformance(strategyName: string): Promise<PerformanceMetrics> {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_decisions,
        AVG(o.response_quality) as avg_quality,
        AVG(o.response_time_ms) as avg_time,
        AVG(o.tokens_used) as avg_tokens,
        AVG(CASE WHEN o.user_feedback = 'positive' THEN 1
                 WHEN o.user_feedback = 'negative' THEN 0
                 ELSE 0.5 END) as satisfaction,
        SUM(CASE WHEN o.user_feedback = 'positive' THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN o.user_feedback = 'negative' THEN 1 ELSE 0 END) as negative_count,
        SUM(CASE WHEN o.user_feedback IS NULL OR o.user_feedback = 'neutral' THEN 1 ELSE 0 END) as neutral_count
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      WHERE d.strategy_name = ?
    `);

    const row = stmt.get(strategyName) as StrategyPerformanceRow | undefined;

    return {
      strategyName,
      totalDecisions: row?.total_decisions ?? 0,
      successRate: row?.avg_quality ?? 0.8,
      averageResponseTime: row?.avg_time ?? 0,
      averageTokens: row?.avg_tokens ?? 0,
      averageQuality: row?.avg_quality ?? 0.8,
      userSatisfaction: row?.satisfaction ?? 0.8,
      costEfficiency: 0.85, // Placeholder
      lastUpdated: new Date()
    };
  }

  // NEW: Get detailed feedback breakdown for dashboard
  async getFeedbackBreakdown(strategyName: string): Promise<{
    positive: number;
    negative: number;
    neutral: number;
    total: number;
    satisfactionTrend: number[];
  }> {
    const stmt = this.db.prepare(`
      SELECT
        SUM(CASE WHEN o.user_feedback = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN o.user_feedback = 'negative' THEN 1 ELSE 0 END) as negative,
        SUM(CASE WHEN o.user_feedback IS NULL OR o.user_feedback = 'neutral' THEN 1 ELSE 0 END) as neutral,
        COUNT(*) as total
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      WHERE d.strategy_name = ?
    `);

    const row = stmt.get(strategyName) as FeedbackBreakdownRow | undefined;

    // Get trend over last 10 decisions
    const trendStmt = this.db.prepare(`
      SELECT
        CASE WHEN o.user_feedback = 'positive' THEN 1
             WHEN o.user_feedback = 'negative' THEN 0
             ELSE 0.5 END as score
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      WHERE d.strategy_name = ?
      ORDER BY d.created_at DESC
      LIMIT 10
    `);

    const trendRows = trendStmt.all(strategyName) as SatisfactionTrendRow[];
    const satisfactionTrend = trendRows.map(r => r.score ?? 0.5).reverse();

    return {
      positive: row?.positive ?? 0,
      negative: row?.negative ?? 0,
      neutral: row?.neutral ?? 0,
      total: row?.total ?? 0,
      satisfactionTrend
    };
  }

  async getModelPerformance(modelName: string): Promise<ModelMetrics> {
    // Similar implementation...
    return {
      modelName,
      totalUsage: 0,
      successRate: 0.9,
      averageResponseTime: 2500,
      averageTokens: 1200,
      averageQuality: 0.88,
      bestUseCases: ['clinical-consult'],
      worstUseCases: [],
      lastUpdated: new Date()
    };
  }

  async cleanupOldData(days = STRATEGY_ANALYTICS_RETENTION_DAYS): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    this.db.exec(`DELETE FROM strategy_outcomes WHERE created_at < '${cutoff}'`);
    this.db.exec(`DELETE FROM strategy_decisions WHERE created_at < '${cutoff}'`);
  }
}
