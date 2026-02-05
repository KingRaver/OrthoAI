-- Conversation summaries and user profile (single-user, local)

CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  content_hash TEXT,
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  content_hash TEXT,
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'success', 'failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_updated_at ON conversation_summaries(updated_at);
CREATE INDEX IF NOT EXISTS idx_user_profile_updated_at ON user_profile(updated_at);
