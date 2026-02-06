-- Phase 3: Clinical Codes System (ICD-10, CPT, Drug Formulary)

-- ICD-10 Diagnosis Codes
CREATE TABLE IF NOT EXISTS icd10_codes (
  code TEXT PRIMARY KEY,
  short_description TEXT NOT NULL,
  long_description TEXT,
  category TEXT,
  chapter TEXT,
  is_billable INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_icd10_codes_category ON icd10_codes(category);
CREATE INDEX IF NOT EXISTS idx_icd10_codes_chapter ON icd10_codes(chapter);

-- CPT Procedure Codes
CREATE TABLE IF NOT EXISTS cpt_codes (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  long_description TEXT,
  category TEXT,
  subcategory TEXT,
  relative_value_units REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cpt_codes_category ON cpt_codes(category);
CREATE INDEX IF NOT EXISTS idx_cpt_codes_subcategory ON cpt_codes(subcategory);

-- Drug Formulary
CREATE TABLE IF NOT EXISTS drug_formulary (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  generic_name TEXT,
  brand_names TEXT,
  drug_class TEXT,
  route TEXT,
  dosage_forms TEXT,
  typical_dosing TEXT,
  max_dose TEXT,
  contraindications TEXT,
  interactions TEXT,
  warnings TEXT,
  orthopedic_uses TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drug_formulary_name ON drug_formulary(name);
CREATE INDEX IF NOT EXISTS idx_drug_formulary_generic_name ON drug_formulary(generic_name);
CREATE INDEX IF NOT EXISTS idx_drug_formulary_drug_class ON drug_formulary(drug_class);

-- FTS indexes for code search
CREATE VIRTUAL TABLE IF NOT EXISTS icd10_fts USING fts5(
  code UNINDEXED,
  short_description,
  long_description,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS icd10_codes_ai
AFTER INSERT ON icd10_codes
BEGIN
  INSERT INTO icd10_fts(code, short_description, long_description)
  VALUES (new.code, new.short_description, new.long_description);
END;

CREATE TRIGGER IF NOT EXISTS icd10_codes_ad
AFTER DELETE ON icd10_codes
BEGIN
  DELETE FROM icd10_fts WHERE code = old.code;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS cpt_fts USING fts5(
  code UNINDEXED,
  description,
  long_description,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS cpt_codes_ai
AFTER INSERT ON cpt_codes
BEGIN
  INSERT INTO cpt_fts(code, description, long_description)
  VALUES (new.code, new.description, new.long_description);
END;

CREATE TRIGGER IF NOT EXISTS cpt_codes_ad
AFTER DELETE ON cpt_codes
BEGIN
  DELETE FROM cpt_fts WHERE code = old.code;
END;

CREATE VIRTUAL TABLE IF NOT EXISTS drug_fts USING fts5(
  id UNINDEXED,
  name,
  generic_name,
  brand_names,
  drug_class,
  orthopedic_uses,
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS drug_formulary_ai
AFTER INSERT ON drug_formulary
BEGIN
  INSERT INTO drug_fts(id, name, generic_name, brand_names, drug_class, orthopedic_uses)
  VALUES (new.id, new.name, new.generic_name, new.brand_names, new.drug_class, new.orthopedic_uses);
END;

CREATE TRIGGER IF NOT EXISTS drug_formulary_ad
AFTER DELETE ON drug_formulary
BEGIN
  DELETE FROM drug_fts WHERE id = old.id;
END;
