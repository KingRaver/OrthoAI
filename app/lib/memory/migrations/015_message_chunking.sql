-- Phase 4: Message chunking tables and lexical index
-- Adds chunk storage for long messages and an FTS index for chunk-level hybrid retrieval.

CREATE TABLE IF NOT EXISTS message_chunks (
  id TEXT PRIMARY KEY,
  parent_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_kind TEXT NOT NULL CHECK (chunk_kind IN ('code', 'prose')),
  content TEXT NOT NULL,
  language TEXT,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_chunks_parent_index
  ON message_chunks(parent_message_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_message_chunks_conversation
  ON message_chunks(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_chunks_kind
  ON message_chunks(chunk_kind);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  chunk_id UNINDEXED,
  parent_message_id UNINDEXED,
  conversation_id UNINDEXED,
  chunk_kind UNINDEXED,
  content,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS message_chunks_ai
AFTER INSERT ON message_chunks
BEGIN
  INSERT INTO chunks_fts(chunk_id, parent_message_id, conversation_id, chunk_kind, content)
  VALUES (new.id, new.parent_message_id, new.conversation_id, new.chunk_kind, new.content);
END;

CREATE TRIGGER IF NOT EXISTS message_chunks_au
AFTER UPDATE ON message_chunks
BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
  INSERT INTO chunks_fts(chunk_id, parent_message_id, conversation_id, chunk_kind, content)
  VALUES (new.id, new.parent_message_id, new.conversation_id, new.chunk_kind, new.content);
END;

CREATE TRIGGER IF NOT EXISTS message_chunks_ad
AFTER DELETE ON message_chunks
BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = old.id;
END;
