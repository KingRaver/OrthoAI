-- OrthoAI Memory System - SQLite Schema
-- Designed for PostgreSQL migration with pgvector extension

-- Conversations table: stores all chat history
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  model_used TEXT,
  total_tokens INTEGER DEFAULT 0,
  summary TEXT,
  tags TEXT  -- JSON array of tags for filtering
);

-- Messages table: individual messages within conversations
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tokens_used INTEGER,
  tool_calls TEXT,  -- JSON array of tool calls made
  tool_results TEXT,  -- JSON array of tool results
  model_used TEXT,
  temperature REAL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- User preferences and metadata
CREATE TABLE IF NOT EXISTS user_preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_type TEXT DEFAULT 'string'  -- string, json, number, boolean
);

-- Embeddings metadata (for Chroma integration)
-- This stores which messages have been embedded and their metadata
CREATE TABLE IF NOT EXISTS embedding_metadata (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  chroma_id TEXT,  -- ID in Chroma vector DB
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Session metadata (for potential multi-user expansion)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default_user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  context_tokens_used INTEGER DEFAULT 0
);

-- Search history and analytics
CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  retrieved_messages_count INTEGER,
  top_similarity_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  response_time_ms INTEGER
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_conversation_id ON embedding_metadata(conversation_id);
CREATE INDEX IF NOT EXISTS idx_embedding_metadata_status ON embedding_metadata(embedding_status);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity);