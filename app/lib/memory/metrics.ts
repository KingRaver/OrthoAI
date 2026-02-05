// app/lib/memory/metrics.ts
// Retrieval metrics tracking for Phase 1 baseline audit

import { getStorage } from './index';
import { getMemoryConfig } from './config';
import { createHash } from 'crypto';

/**
 * Retrieval metrics schema (matches CONTEXT.MD specification)
 */
export interface RetrievalMetrics {
  query: string;
  timestamp: number;
  conversationId?: string;
  sources: {
    conversationDense: number;    // Count of results
    globalDense: number;
    summaries: number;
    profile: number;
    ftsLexical?: number;          // When RAG_HYBRID=true
  };
  latency: {
    totalMs: number;
    denseMs: number;
    ftsMs?: number;               // When RAG_HYBRID=true
    rerankMs?: number;
  };
  topSimilarities: number[];      // Top 3 scores
  flags: {
    hybrid: boolean;
    chunking: boolean;
    tokenBudget: number;
  };
}

/**
 * Log retrieval metrics to database
 */
export async function logRetrievalMetrics(metrics: RetrievalMetrics): Promise<void> {
  try {
    const storage = getStorage();
    const id = generateMetricId(metrics);

    const stmt = storage['db'].prepare(`
      INSERT INTO retrieval_metrics (
        id, query, conversation_id, timestamp,
        source_conversation_dense, source_global_dense, source_summaries, source_profile, source_fts_lexical,
        latency_total_ms, latency_dense_ms, latency_fts_ms, latency_rerank_ms,
        top_similarity_1, top_similarity_2, top_similarity_3,
        flag_hybrid, flag_chunking, flag_token_budget
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      metrics.query,
      metrics.conversationId || null,
      metrics.timestamp,
      metrics.sources.conversationDense,
      metrics.sources.globalDense,
      metrics.sources.summaries,
      metrics.sources.profile,
      metrics.sources.ftsLexical || 0,
      metrics.latency.totalMs,
      metrics.latency.denseMs,
      metrics.latency.ftsMs || 0,
      metrics.latency.rerankMs || 0,
      metrics.topSimilarities[0] || null,
      metrics.topSimilarities[1] || null,
      metrics.topSimilarities[2] || null,
      metrics.flags.hybrid ? 1 : 0,
      metrics.flags.chunking ? 1 : 0,
      metrics.flags.tokenBudget
    );

    console.log(`[Metrics] Logged retrieval: ${metrics.latency.totalMs}ms, ${getTotalResults(metrics)} results`);
  } catch (error) {
    // Don't throw - metrics logging should never break the app
    console.warn('[Metrics] Failed to log retrieval metrics:', error);
  }
}

/**
 * Clean up old metrics based on retention policy
 */
export async function cleanupOldMetrics(): Promise<number> {
  try {
    const storage = getStorage();
    const config = getMemoryConfig();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.metricsRetentionDays);

    const stmt = storage['db'].prepare(`
      DELETE FROM retrieval_metrics
      WHERE created_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    const deleted = result.changes || 0;

    if (deleted > 0) {
      console.log(`[Metrics] Cleaned up ${deleted} old metrics (older than ${config.metricsRetentionDays} days)`);
    }

    return deleted;
  } catch (error) {
    console.warn('[Metrics] Failed to cleanup old metrics:', error);
    return 0;
  }
}

/**
 * Get retrieval metrics summary for a date range
 */
export interface MetricsSummary {
  totalQueries: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  avgTopSimilarity: number;
  hybridEnabledCount: number;
  chunkingEnabledCount: number;
  sourceDistribution: {
    conversationDense: number;
    globalDense: number;
    summaries: number;
    profile: number;
    ftsLexical: number;
  };
}

export async function getMetricsSummary(
  startDate?: Date,
  endDate?: Date
): Promise<MetricsSummary> {
  const storage = getStorage();
  const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days
  const end = endDate || new Date();

  const stmt = storage['db'].prepare(`
    SELECT
      COUNT(*) as total_queries,
      AVG(latency_total_ms) as avg_latency_ms,
      MAX(latency_total_ms) as max_latency_ms,
      AVG(top_similarity_1) as avg_top_similarity,
      SUM(flag_hybrid) as hybrid_enabled_count,
      SUM(flag_chunking) as chunking_enabled_count,
      SUM(source_conversation_dense) as total_conversation_dense,
      SUM(source_global_dense) as total_global_dense,
      SUM(source_summaries) as total_summaries,
      SUM(source_profile) as total_profile,
      SUM(source_fts_lexical) as total_fts_lexical
    FROM retrieval_metrics
    WHERE created_at BETWEEN ? AND ?
  `);

  const row = stmt.get(start.toISOString(), end.toISOString()) as any;

  return {
    totalQueries: row.total_queries || 0,
    avgLatencyMs: row.avg_latency_ms || 0,
    maxLatencyMs: row.max_latency_ms || 0,
    avgTopSimilarity: row.avg_top_similarity || 0,
    hybridEnabledCount: row.hybrid_enabled_count || 0,
    chunkingEnabledCount: row.chunking_enabled_count || 0,
    sourceDistribution: {
      conversationDense: row.total_conversation_dense || 0,
      globalDense: row.total_global_dense || 0,
      summaries: row.total_summaries || 0,
      profile: row.total_profile || 0,
      ftsLexical: row.total_fts_lexical || 0,
    },
  };
}

/**
 * Get daily metrics for visualization
 */
export interface DailyMetrics {
  date: string;
  totalQueries: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  avgTopSimilarity: number;
}

export async function getDailyMetrics(days: number = 30): Promise<DailyMetrics[]> {
  const storage = getStorage();

  const stmt = storage['db'].prepare(`
    SELECT * FROM retrieval_metrics_summary
    ORDER BY date DESC
    LIMIT ?
  `);

  const rows = stmt.all(days) as any[];

  return rows.map(row => ({
    date: row.date,
    totalQueries: row.total_queries || 0,
    avgLatencyMs: row.avg_latency_ms || 0,
    maxLatencyMs: row.max_latency_ms || 0,
    avgTopSimilarity: row.avg_top_similarity || 0,
  }));
}

// Helper functions

function generateMetricId(metrics: RetrievalMetrics): string {
  const hash = createHash('sha256');
  hash.update(`${metrics.query}-${metrics.timestamp}-${Math.random()}`);
  return `metric-${hash.digest('hex').slice(0, 16)}`;
}

function getTotalResults(metrics: RetrievalMetrics): number {
  return (
    metrics.sources.conversationDense +
    metrics.sources.globalDense +
    metrics.sources.summaries +
    metrics.sources.profile +
    (metrics.sources.ftsLexical || 0)
  );
}
