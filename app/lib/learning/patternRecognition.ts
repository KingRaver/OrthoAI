/**
 * Pattern Recognition System
 * Learns orthopedic research themes to improve model selection
 */

import sqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), '.data', 'learning_patterns.db');

export interface ConversationPattern {
  id: string;
  theme: string;
  keywords: string[];
  complexity: number;
  successfulModel: string;
  avgQuality: number;
  occurrences: number;
  lastSeen: Date;
}

export interface ThemeDetectionResult {
  primaryTheme: string;
  confidence: number;
  suggestedModel: string;
  suggestedTemperature: number;
  reasoning: string;
}

export class PatternRecognizer {
  private db!: sqlite3.Database;

  // Common themes in orthopedic research
  private themePatterns = {
    'evidence-synthesis': {
      keywords: ['systematic review', 'meta-analysis', 'cohort', 'rct', 'trial', 'evidence', 'compare studies'],
      defaultComplexity: 60
    },
    'mechanistic': {
      keywords: ['mechanism', 'biomechanics', 'load', 'strain', 'stress', 'ecm', 'collagen', 'healing'],
      defaultComplexity: 70
    },
    'study-design': {
      keywords: ['study design', 'protocol', 'endpoint', 'sample size', 'power', 'randomized', 'blinding'],
      defaultComplexity: 75
    },
    'hypothesis': {
      keywords: ['hypothesis', 'predict', 'novel', 'breakthrough', 'testable'],
      defaultComplexity: 65
    },
    'surgical-technique': {
      keywords: ['arthroscopy', 'repair', 'reconstruction', 'implant', 'fixation', 'graft'],
      defaultComplexity: 70
    },
    'imaging': {
      keywords: ['mri', 'ultrasound', 'ct', 'radiograph', 't1', 't2', 'pd'],
      defaultComplexity: 55
    },
    'rehabilitation': {
      keywords: ['rehab', 'physical therapy', 'return to play', 'eccentric', 'isometric'],
      defaultComplexity: 50
    }
  };

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
      CREATE TABLE IF NOT EXISTS conversation_patterns (
        id TEXT PRIMARY KEY,
        theme TEXT NOT NULL,
        keywords TEXT NOT NULL,
        complexity INTEGER,
        successful_model TEXT,
        avg_quality REAL DEFAULT 0.8,
        occurrences INTEGER DEFAULT 1,
        last_seen TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_theme ON conversation_patterns(theme);
      CREATE INDEX IF NOT EXISTS idx_last_seen ON conversation_patterns(last_seen);

      CREATE TABLE IF NOT EXISTS theme_feedback (
        id TEXT PRIMARY KEY,
        theme TEXT NOT NULL,
        user_message TEXT NOT NULL,
        model_used TEXT NOT NULL,
        quality_score REAL NOT NULL,
        user_feedback TEXT,
        complexity INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_theme_feedback ON theme_feedback(theme);
    `);
  }

  /**
   * Detect the primary theme of a user message
   */
  async detectTheme(userMessage: string): Promise<ThemeDetectionResult> {
    const messageLower = userMessage.toLowerCase();

    const themeScores: { [theme: string]: number } = {};

    for (const [theme, config] of Object.entries(this.themePatterns)) {
      let score = 0;
      for (const keyword of config.keywords) {
        if (messageLower.includes(keyword)) {
          score += keyword.split(' ').length;
        }
      }

      if (score > 0) {
        themeScores[theme] = score;
      }
    }

    let primaryTheme = 'evidence-synthesis';
    let maxScore = 0;

    for (const [theme, score] of Object.entries(themeScores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryTheme = theme;
      }
    }

    const historicalData = await this.getThemeHistory(primaryTheme);
    const confidence = Math.min(0.95, maxScore / 5 + (historicalData.occurrences > 0 ? 0.2 : 0));
    const suggestedModel = this.suggestModelForTheme(primaryTheme, historicalData);
    const suggestedTemperature = this.suggestTemperatureForTheme(primaryTheme);

    return {
      primaryTheme,
      confidence,
      suggestedModel,
      suggestedTemperature,
      reasoning: `Detected ${primaryTheme} theme (conf: ${confidence.toFixed(2)}). ${
        historicalData.occurrences > 0
          ? `Historical avg quality: ${historicalData.avgQuality.toFixed(2)}`
          : 'No historical data'
      }`
    };
  }

  private async getThemeHistory(theme: string): Promise<ConversationPattern> {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_patterns WHERE theme = ? ORDER BY last_seen DESC LIMIT 1
    `);

    const row = stmt.get(theme) as any;

    if (row) {
      return {
        id: row.id,
        theme: row.theme,
        keywords: JSON.parse(row.keywords),
        complexity: row.complexity,
        successfulModel: row.successful_model,
        avgQuality: row.avg_quality,
        occurrences: row.occurrences,
        lastSeen: new Date(row.last_seen)
      };
    }

    return {
      id: `pattern_${Date.now()}`,
      theme,
      keywords: this.themePatterns[theme as keyof typeof this.themePatterns]?.keywords || [],
      complexity: this.themePatterns[theme as keyof typeof this.themePatterns]?.defaultComplexity || 50,
      successfulModel: 'biomistral-7b-instruct',
      avgQuality: 0.8,
      occurrences: 0,
      lastSeen: new Date()
    };
  }

  async recordThemeFeedback(
    theme: string,
    userMessage: string,
    modelUsed: string,
    qualityScore: number,
    userFeedback?: 'positive' | 'negative' | 'neutral',
    complexity?: number
  ): Promise<void> {
    const feedbackStmt = this.db.prepare(`
      INSERT INTO theme_feedback
      (id, theme, user_message, model_used, quality_score, user_feedback, complexity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    feedbackStmt.run(
      `feedback_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      theme,
      userMessage.slice(0, 500),
      modelUsed,
      qualityScore,
      userFeedback || null,
      complexity || 50,
      new Date().toISOString()
    );

    const existingPattern = await this.getThemeHistory(theme);

    const newAvgQuality = existingPattern.occurrences > 0
      ? (existingPattern.avgQuality * existingPattern.occurrences + qualityScore) / (existingPattern.occurrences + 1)
      : qualityScore;

    const upsertStmt = this.db.prepare(`
      INSERT INTO conversation_patterns
      (id, theme, keywords, complexity, successful_model, avg_quality, occurrences, last_seen, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        avg_quality = ?,
        occurrences = occurrences + 1,
        last_seen = ?,
        successful_model = CASE WHEN ? > avg_quality THEN ? ELSE successful_model END
    `);

    const now = new Date().toISOString();
    upsertStmt.run(
      existingPattern.id,
      theme,
      JSON.stringify(existingPattern.keywords),
      complexity || existingPattern.complexity,
      qualityScore > existingPattern.avgQuality ? modelUsed : existingPattern.successfulModel,
      newAvgQuality,
      existingPattern.occurrences + 1,
      now,
      existingPattern.lastSeen.toISOString(),
      newAvgQuality,
      now,
      qualityScore,
      modelUsed
    );

    console.log(`[Pattern] Updated ${theme} pattern: quality ${newAvgQuality.toFixed(2)}, occurrences ${existingPattern.occurrences + 1}`);
  }

  private suggestModelForTheme(theme: string, historicalData: ConversationPattern): string {
    if (historicalData.occurrences >= 3 && historicalData.avgQuality > 0.75) {
      return historicalData.successfulModel;
    }

    const complexity = this.themePatterns[theme as keyof typeof this.themePatterns]?.defaultComplexity || 50;

    if (complexity >= 65) {
      return 'biomistral-7b-instruct';
    } else {
      return 'biogpt';
    }
  }

  private suggestTemperatureForTheme(theme: string): number {
    const creativeTasks = ['hypothesis'];
    const preciseTasks = ['study-design', 'evidence-synthesis'];

    if (creativeTasks.includes(theme)) {
      return 0.6;
    } else if (preciseTasks.includes(theme)) {
      return 0.3;
    } else {
      return 0.4;
    }
  }

  async getThemeAnalytics(): Promise<{
    theme: string;
    occurrences: number;
    avgQuality: number;
    topModel: string;
  }[]> {
    const stmt = this.db.prepare(`
      SELECT theme, SUM(occurrences) as total_occurrences, AVG(avg_quality) as avg_quality, successful_model
      FROM conversation_patterns
      GROUP BY theme
      ORDER BY total_occurrences DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      theme: row.theme,
      occurrences: row.total_occurrences,
      avgQuality: row.avg_quality,
      topModel: row.successful_model
    }));
  }

  async cleanupOldData(days = 90): Promise<void> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    this.db.exec(`DELETE FROM theme_feedback WHERE created_at < '${cutoff}'`);
    console.log(`[Pattern] Cleaned up feedback older than ${days} days`);
  }
}

// Singleton
export const patternRecognizer = new PatternRecognizer();
