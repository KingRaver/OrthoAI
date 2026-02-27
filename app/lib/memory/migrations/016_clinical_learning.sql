-- Phase 7: Clinical learning, corrections, and subspecialty optimization

CREATE TABLE IF NOT EXISTS clinical_learning_corrections (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  source_message TEXT NOT NULL,
  corrected_recommendation TEXT NOT NULL,
  subspecialty TEXT,
  diagnosis_tag TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES patient_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clinical_learning_corrections_case_id
  ON clinical_learning_corrections(case_id);
CREATE INDEX IF NOT EXISTS idx_clinical_learning_corrections_subspecialty
  ON clinical_learning_corrections(subspecialty);

CREATE TABLE IF NOT EXISTS clinical_ab_experiments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  strategy_variant TEXT NOT NULL, -- variant_a | variant_b
  response_quality REAL,
  user_feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES patient_cases(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clinical_ab_experiments_case_id
  ON clinical_ab_experiments(case_id);
CREATE INDEX IF NOT EXISTS idx_clinical_ab_experiments_variant
  ON clinical_ab_experiments(strategy_variant);

CREATE TABLE IF NOT EXISTS model_registry (
  id TEXT PRIMARY KEY,
  subspecialty TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  endpoint TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_model_registry_unique
  ON model_registry(subspecialty, model_name, model_version);
CREATE INDEX IF NOT EXISTS idx_model_registry_active
  ON model_registry(subspecialty, is_active);

CREATE TABLE IF NOT EXISTS subspecialty_ensemble_weights (
  subspecialty TEXT PRIMARY KEY,
  biomistral_weight REAL NOT NULL DEFAULT 0.7,
  meditron_weight REAL NOT NULL DEFAULT 0.3,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO subspecialty_ensemble_weights(subspecialty, biomistral_weight, meditron_weight)
VALUES
  ('general', 0.7, 0.3),
  ('sports', 0.65, 0.35),
  ('spine', 0.75, 0.25),
  ('trauma', 0.7, 0.3),
  ('arthroplasty', 0.72, 0.28),
  ('pediatric', 0.68, 0.32);

