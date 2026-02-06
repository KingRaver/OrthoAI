-- Phase 3: Patient Case System

CREATE TABLE IF NOT EXISTS patient_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  demographics TEXT,
  history TEXT,
  complaints TEXT,
  imaging TEXT,
  labs TEXT,
  medications TEXT,
  allergies TEXT,
  tags TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_cases_status ON patient_cases(status);
CREATE INDEX IF NOT EXISTS idx_patient_cases_created_at ON patient_cases(created_at);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  summary TEXT,
  details TEXT,
  occurred_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES patient_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id ON case_events(case_id);
CREATE INDEX IF NOT EXISTS idx_case_events_occurred_at ON case_events(occurred_at);

CREATE TABLE IF NOT EXISTS case_conversations (
  case_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (case_id, conversation_id),
  FOREIGN KEY (case_id) REFERENCES patient_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_case_conversations_case_id ON case_conversations(case_id);
