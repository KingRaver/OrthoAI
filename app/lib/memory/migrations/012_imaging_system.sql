-- Phase 3: DICOM Imaging System

-- Imaging Studies (X-ray, MRI, CT, etc.)
CREATE TABLE IF NOT EXISTS imaging_studies (
  id TEXT PRIMARY KEY,
  case_id TEXT,
  study_type TEXT NOT NULL,
  modality TEXT,
  body_part TEXT,
  laterality TEXT,
  study_date DATETIME,
  description TEXT,
  file_path TEXT,
  dicom_metadata TEXT,
  findings TEXT,
  impression TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (case_id) REFERENCES patient_cases(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_imaging_studies_case_id ON imaging_studies(case_id);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_type ON imaging_studies(study_type);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_modality ON imaging_studies(modality);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_body_part ON imaging_studies(body_part);
CREATE INDEX IF NOT EXISTS idx_imaging_studies_study_date ON imaging_studies(study_date);

-- Imaging Annotations (measurements, markups, etc.)
CREATE TABLE IF NOT EXISTS imaging_annotations (
  id TEXT PRIMARY KEY,
  study_id TEXT NOT NULL,
  annotation_type TEXT NOT NULL,
  label TEXT,
  data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (study_id) REFERENCES imaging_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_imaging_annotations_study_id ON imaging_annotations(study_id);
CREATE INDEX IF NOT EXISTS idx_imaging_annotations_type ON imaging_annotations(annotation_type);

-- Finding Templates (common orthopedic findings)
CREATE TABLE IF NOT EXISTS finding_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  modality TEXT,
  body_part TEXT,
  template_text TEXT NOT NULL,
  variables TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finding_templates_category ON finding_templates(category);
CREATE INDEX IF NOT EXISTS idx_finding_templates_modality ON finding_templates(modality);
CREATE INDEX IF NOT EXISTS idx_finding_templates_body_part ON finding_templates(body_part);

-- Study Comparisons (for side-by-side, pre/post analysis)
CREATE TABLE IF NOT EXISTS study_comparisons (
  id TEXT PRIMARY KEY,
  study_id_1 TEXT NOT NULL,
  study_id_2 TEXT NOT NULL,
  comparison_type TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (study_id_1) REFERENCES imaging_studies(id) ON DELETE CASCADE,
  FOREIGN KEY (study_id_2) REFERENCES imaging_studies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_comparisons_study1 ON study_comparisons(study_id_1);
CREATE INDEX IF NOT EXISTS idx_study_comparisons_study2 ON study_comparisons(study_id_2);

-- Insert common orthopedic finding templates
INSERT OR IGNORE INTO finding_templates (id, name, category, modality, body_part, template_text, variables)
VALUES
  ('tpl_fx_type', 'Fracture Classification', 'fracture', 'X-ray', NULL,
   '{bone} {fracture_type} fracture at {location}. {displacement}. {angulation}.',
   '["bone","fracture_type","location","displacement","angulation"]'),

  ('tpl_oa_grade', 'Osteoarthritis Grading', 'arthritis', 'X-ray', NULL,
   'Kellgren-Lawrence grade {grade}/4 osteoarthritis of the {joint}. {joint_space}. {osteophytes}. {subchondral}.',
   '["grade","joint","joint_space","osteophytes","subchondral"]'),

  ('tpl_acl_tear', 'ACL Tear', 'ligament', 'MRI', 'knee',
   '{tear_type} ACL tear. {location}. {bone_bruise}. {associated_injuries}.',
   '["tear_type","location","bone_bruise","associated_injuries"]'),

  ('tpl_rotator_cuff', 'Rotator Cuff Tear', 'tendon', 'MRI', 'shoulder',
   '{tear_type} {tendon} tear measuring {size}. {retraction}. {muscle_atrophy}.',
   '["tear_type","tendon","size","retraction","muscle_atrophy"]'),

  ('tpl_disc_herniation', 'Disc Herniation', 'spine', 'MRI', 'spine',
   '{level} {herniation_type} disc herniation. {canal_stenosis}. {nerve_compression}.',
   '["level","herniation_type","canal_stenosis","nerve_compression"]'),

  ('tpl_meniscus', 'Meniscus Tear', 'cartilage', 'MRI', 'knee',
   '{tear_type} tear of the {meniscus} meniscus at {location}. {grade}.',
   '["tear_type","meniscus","location","grade"]');
