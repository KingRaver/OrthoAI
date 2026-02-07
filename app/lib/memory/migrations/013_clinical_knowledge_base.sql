-- Phase 5: Clinical Knowledge Base (Guidelines, Evidence, and Reference Data)

-- Source registry for guideline/evidence integrations
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  authority TEXT,
  category TEXT NOT NULL, -- guideline | evidence | reference
  source_type TEXT NOT NULL, -- aaos | ao | acsm | pt | atlas | pubmed | cochrane | local
  endpoint TEXT,
  enabled INTEGER DEFAULT 1,
  sync_cursor TEXT,
  last_synced_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_category ON knowledge_sources(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type ON knowledge_sources(source_type);

-- Background job queue for sync/update work
CREATE TABLE IF NOT EXISTS knowledge_sync_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL, -- guideline_seed | evidence_sync | cleanup
  source_key TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  payload TEXT, -- JSON
  attempt_count INTEGER DEFAULT 0,
  cursor_from TEXT,
  cursor_to TEXT,
  records_fetched INTEGER DEFAULT 0,
  records_ingested INTEGER DEFAULT 0,
  error_message TEXT,
  scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  finished_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sync_jobs_status ON knowledge_sync_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_sync_jobs_source_key ON knowledge_sync_jobs(source_key);

-- Local evidence cache (PubMed/Cochrane and other literature sources)
CREATE TABLE IF NOT EXISTS knowledge_evidence (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  abstract_text TEXT,
  url TEXT,
  journal TEXT,
  authors TEXT, -- JSON array
  publication_date DATETIME,
  publication_types TEXT, -- JSON array
  study_type TEXT,
  evidence_level TEXT,
  evidence_score REAL DEFAULT 0,
  keywords TEXT, -- JSON array
  raw_payload TEXT, -- JSON blob for source-specific fields
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_key, external_id)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_source_key ON knowledge_evidence(source_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_publication_date ON knowledge_evidence(publication_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_level ON knowledge_evidence(evidence_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_evidence_score ON knowledge_evidence(evidence_score DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_evidence_fts USING fts5(
  evidence_id UNINDEXED,
  title,
  abstract_text,
  keywords,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS knowledge_evidence_ai
AFTER INSERT ON knowledge_evidence
BEGIN
  INSERT INTO knowledge_evidence_fts(evidence_id, title, abstract_text, keywords)
  VALUES (new.id, new.title, new.abstract_text, new.keywords);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_evidence_au
AFTER UPDATE ON knowledge_evidence
BEGIN
  DELETE FROM knowledge_evidence_fts WHERE evidence_id = old.id;
  INSERT INTO knowledge_evidence_fts(evidence_id, title, abstract_text, keywords)
  VALUES (new.id, new.title, new.abstract_text, new.keywords);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_evidence_ad
AFTER DELETE ON knowledge_evidence
BEGIN
  DELETE FROM knowledge_evidence_fts WHERE evidence_id = old.id;
END;

-- Drug/device/protocol reference data for treatment support
CREATE TABLE IF NOT EXISTS clinical_reference_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('implant', 'medication_protocol', 'injection_technique', 'dme_bracing')),
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  indications TEXT,
  contraindications TEXT,
  metadata_json TEXT,
  source TEXT,
  version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clinical_reference_items_category ON clinical_reference_items(category);
CREATE INDEX IF NOT EXISTS idx_clinical_reference_items_name ON clinical_reference_items(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_reference_items_unique ON clinical_reference_items(category, name);

CREATE VIRTUAL TABLE IF NOT EXISTS clinical_reference_items_fts USING fts5(
  item_id UNINDEXED,
  name,
  summary,
  indications,
  contraindications,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS clinical_reference_items_ai
AFTER INSERT ON clinical_reference_items
BEGIN
  INSERT INTO clinical_reference_items_fts(item_id, name, summary, indications, contraindications)
  VALUES (new.id, new.name, new.summary, new.indications, new.contraindications);
END;

CREATE TRIGGER IF NOT EXISTS clinical_reference_items_au
AFTER UPDATE ON clinical_reference_items
BEGIN
  DELETE FROM clinical_reference_items_fts WHERE item_id = old.id;
  INSERT INTO clinical_reference_items_fts(item_id, name, summary, indications, contraindications)
  VALUES (new.id, new.name, new.summary, new.indications, new.contraindications);
END;

CREATE TRIGGER IF NOT EXISTS clinical_reference_items_ad
AFTER DELETE ON clinical_reference_items
BEGIN
  DELETE FROM clinical_reference_items_fts WHERE item_id = old.id;
END;

-- Version tracking for guideline updates
CREATE TABLE IF NOT EXISTS knowledge_guideline_versions (
  id TEXT PRIMARY KEY,
  guideline_key TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  document_id TEXT,
  content_hash TEXT NOT NULL,
  published_at DATETIME,
  is_current INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  UNIQUE (guideline_key, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_guideline_versions_guideline_key ON knowledge_guideline_versions(guideline_key);
CREATE INDEX IF NOT EXISTS idx_knowledge_guideline_versions_is_current ON knowledge_guideline_versions(is_current);

-- Storage quota and cleanup policy
CREATE TABLE IF NOT EXISTS knowledge_storage_policy (
  id TEXT PRIMARY KEY,
  max_chunk_characters INTEGER NOT NULL DEFAULT 1500000,
  max_evidence_records INTEGER NOT NULL DEFAULT 5000,
  retention_days INTEGER NOT NULL DEFAULT 365,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO knowledge_storage_policy (id, max_chunk_characters, max_evidence_records, retention_days)
VALUES ('default', 1500000, 5000, 365);
