-- Phase 3: FTS Triggers and Backfill
-- Auto-sync triggers for FTS index and backfill historical data

-- Backfill existing messages into FTS index (run before triggers to avoid duplicates)
INSERT OR IGNORE INTO messages_fts(message_id, conversation_id, content, role)
SELECT id, conversation_id, content, role
FROM messages
WHERE role IN ('user', 'assistant')

;

-- Keep FTS index in sync with messages table
CREATE TRIGGER IF NOT EXISTS messages_ai
AFTER INSERT ON messages
WHEN new.role IN ('user', 'assistant')
BEGIN
  INSERT INTO messages_fts(message_id, conversation_id, content, role)
  VALUES (new.id, new.conversation_id, new.content, new.role);
END;

CREATE TRIGGER IF NOT EXISTS messages_au
AFTER UPDATE ON messages
BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
  INSERT INTO messages_fts(message_id, conversation_id, content, role)
  SELECT new.id, new.conversation_id, new.content, new.role
  WHERE new.role IN ('user', 'assistant');
END;

CREATE TRIGGER IF NOT EXISTS messages_ad
AFTER DELETE ON messages
BEGIN
  DELETE FROM messages_fts WHERE message_id = old.id;
END;
