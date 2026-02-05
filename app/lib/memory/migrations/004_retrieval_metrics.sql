-- Phase 1: Baseline Audit + Diagnostics
-- Retrieval metrics table for tracking RAG performance

CREATE TABLE IF NOT EXISTS retrieval_metrics (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  conversation_id TEXT,
  timestamp INTEGER NOT NULL,

  -- Source counts
  source_conversation_dense INTEGER DEFAULT 0,
  source_global_dense INTEGER DEFAULT 0,
  source_summaries INTEGER DEFAULT 0,
  source_profile INTEGER DEFAULT 0,
  source_fts_lexical INTEGER DEFAULT 0,

  -- Latency tracking (milliseconds)
  latency_total_ms INTEGER NOT NULL,
  latency_dense_ms INTEGER DEFAULT 0,
  latency_fts_ms INTEGER DEFAULT 0,
  latency_rerank_ms INTEGER DEFAULT 0,

  -- Quality metrics
  top_similarity_1 REAL,
  top_similarity_2 REAL,
  top_similarity_3 REAL,

  -- Feature flags at time of retrieval
  flag_hybrid INTEGER DEFAULT 0,
  flag_chunking INTEGER DEFAULT 0,
  flag_token_budget INTEGER DEFAULT 1000,

  -- Cleanup: auto-delete after 30 days
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_timestamp ON retrieval_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_conversation ON retrieval_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_retrieval_metrics_created_at ON retrieval_metrics(created_at);

-- View for easy metric aggregation
CREATE VIEW IF NOT EXISTS retrieval_metrics_summary AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_queries,
  AVG(latency_total_ms) as avg_latency_ms,
  MAX(latency_total_ms) as max_latency_ms,
  AVG(top_similarity_1) as avg_top_similarity,
  SUM(flag_hybrid) as hybrid_enabled_count,
  SUM(flag_chunking) as chunking_enabled_count
FROM retrieval_metrics
GROUP BY DATE(created_at)
ORDER BY date DESC;
