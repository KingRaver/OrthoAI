-- Track C: Summary/profile operational reliability instrumentation

CREATE TABLE IF NOT EXISTS summary_health (
  conversation_id TEXT PRIMARY KEY,
  last_state TEXT NOT NULL DEFAULT 'queued'
    CHECK (last_state IN ('queued', 'running', 'succeeded', 'failed', 'skipped_no_consent')),
  last_run_at DATETIME,
  last_success_at DATETIME,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  total_runs INTEGER NOT NULL DEFAULT 0,
  total_successes INTEGER NOT NULL DEFAULT 0,
  total_failures INTEGER NOT NULL DEFAULT 0,
  total_retries INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summary_health_state ON summary_health(last_state);
CREATE INDEX IF NOT EXISTS idx_summary_health_updated_at ON summary_health(updated_at);

CREATE TABLE IF NOT EXISTS summary_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  state TEXT NOT NULL
    CHECK (state IN ('queued', 'running', 'succeeded', 'failed', 'skipped_no_consent')),
  attempt INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  metadata TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summary_events_conversation_created
  ON summary_events(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summary_events_created_at
  ON summary_events(created_at DESC);
