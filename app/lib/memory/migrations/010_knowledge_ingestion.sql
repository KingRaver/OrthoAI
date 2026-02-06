-- Phase 3: Clinical Knowledge Ingestion

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT,
  version TEXT,
  subspecialty TEXT,
  diagnosis_tags TEXT,
  content_type TEXT DEFAULT 'text',
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_subspecialty ON knowledge_documents(subspecialty);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_created_at ON knowledge_documents(created_at);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON knowledge_chunks(document_id);

-- FTS index for knowledge chunks (hybrid retrieval)
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_chunks_fts USING fts5(
  chunk_id UNINDEXED,
  document_id UNINDEXED,
  content,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ai
AFTER INSERT ON knowledge_chunks
BEGIN
  INSERT INTO knowledge_chunks_fts(chunk_id, document_id, content)
  VALUES (new.id, new.document_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_chunks_au
AFTER UPDATE ON knowledge_chunks
BEGIN
  DELETE FROM knowledge_chunks_fts WHERE chunk_id = old.id;
  INSERT INTO knowledge_chunks_fts(chunk_id, document_id, content)
  VALUES (new.id, new.document_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_chunks_ad
AFTER DELETE ON knowledge_chunks
BEGIN
  DELETE FROM knowledge_chunks_fts WHERE chunk_id = old.id;
END;
