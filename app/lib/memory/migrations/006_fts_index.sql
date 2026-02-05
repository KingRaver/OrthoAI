-- Phase 3: Full-Text Search (FTS) Index for Hybrid Retrieval
-- Creates FTS5 virtual table for lexical search alongside semantic (dense) search
-- See CONTEXT.MD Phase 3 for implementation details

-- FTS5 virtual table for message content
-- Indexes user and assistant messages for keyword/code identifier search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  message_id UNINDEXED,
  conversation_id UNINDEXED,
  content,
  role UNINDEXED,
  tokenize='porter unicode61'
)
