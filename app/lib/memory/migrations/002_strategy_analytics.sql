-- Strategy Analytics Migration
-- Adds tables for tracking strategy decisions and outcomes

CREATE TABLE IF NOT EXISTS strategy_decisions (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  message_id TEXT,
  strategy_name TEXT NOT NULL,
  selected_model TEXT NOT NULL,
  reasoning TEXT,
  confidence REAL,
  context_complexity TEXT,
  complexity_score INTEGER,
  decision_time_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS strategy_outcomes (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  response_quality REAL DEFAULT 0.8,
  user_feedback TEXT CHECK(user_feedback IN ('positive', 'negative', 'neutral')),
  response_time_ms INTEGER,
  tokens_used INTEGER,
  error_occurred BOOLEAN DEFAULT FALSE,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (decision_id) REFERENCES strategy_decisions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_strategy_decisions_strategy ON strategy_decisions(strategy_name);
CREATE INDEX IF NOT EXISTS idx_strategy_decisions_conversation ON strategy_decisions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_strategy_outcomes_decision ON strategy_outcomes(decision_id);
