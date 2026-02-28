-- Clinical reasoning benchmark runs (hybrid auto + clinician workflow)

CREATE TABLE IF NOT EXISTS clinical_benchmark_runs (
  id TEXT PRIMARY KEY,
  benchmark_type TEXT NOT NULL CHECK (benchmark_type IN ('decision-support', 'llm', 'all')),
  fixture_version TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  automatic_gate_passed INTEGER,
  clinician_gate_passed INTEGER,
  baseline_run_id TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (baseline_run_id) REFERENCES clinical_benchmark_runs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_runs_type_started
  ON clinical_benchmark_runs(benchmark_type, started_at DESC);

CREATE TABLE IF NOT EXISTS clinical_benchmark_case_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  benchmark_target TEXT NOT NULL CHECK (benchmark_target IN ('decision-support', 'llm')),
  case_id TEXT NOT NULL,
  case_title TEXT NOT NULL,
  mode_used TEXT,
  model_used TEXT,
  average_score REAL NOT NULL,
  passed_automatic INTEGER NOT NULL,
  passed_clinician INTEGER,
  automatic_notes TEXT,
  clinician_notes TEXT,
  disagreement_count INTEGER NOT NULL DEFAULT 0,
  adjudication_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (adjudication_status IN ('not_required', 'pending', 'agreed', 'disputed', 'resolved')),
  response_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (run_id) REFERENCES clinical_benchmark_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_case_results_run
  ON clinical_benchmark_case_results(run_id);
CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_case_results_target_case
  ON clinical_benchmark_case_results(benchmark_target, case_id);
CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_case_results_pass
  ON clinical_benchmark_case_results(benchmark_target, passed_automatic, created_at DESC);

CREATE TABLE IF NOT EXISTS clinical_benchmark_dimension_scores (
  id TEXT PRIMARY KEY,
  case_result_id TEXT NOT NULL,
  dimension_key TEXT NOT NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('automated', 'clinician_primary', 'clinician_secondary', 'adjudicated')),
  reviewer_id TEXT,
  score REAL NOT NULL CHECK (score >= 0 AND score <= 4),
  rationale TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_result_id) REFERENCES clinical_benchmark_case_results(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clinical_benchmark_dimension_scores_unique
  ON clinical_benchmark_dimension_scores(case_result_id, dimension_key, source_type, COALESCE(reviewer_id, ''));
CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_dimension_scores_case
  ON clinical_benchmark_dimension_scores(case_result_id);
CREATE INDEX IF NOT EXISTS idx_clinical_benchmark_dimension_scores_dimension
  ON clinical_benchmark_dimension_scores(dimension_key, source_type, created_at DESC);
