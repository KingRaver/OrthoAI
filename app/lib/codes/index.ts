import { getStorage } from '@/app/lib/memory';
import { createHash } from 'crypto';
import type {
  ICD10Code,
  CPTCode,
  Drug,
  CodeSearchOptions,
  ICD10Input,
  CPTInput,
  DrugInput
} from './types';

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

type DbICD10Row = {
  code: string;
  short_description: string;
  long_description: string | null;
  category: string | null;
  chapter: string | null;
  is_billable: number;
  created_at: string;
};

type DbCPTRow = {
  code: string;
  description: string;
  long_description: string | null;
  category: string | null;
  subcategory: string | null;
  relative_value_units: number | null;
  created_at: string;
};

type DbDrugRow = {
  id: string;
  name: string;
  generic_name: string | null;
  brand_names: string | null;
  drug_class: string | null;
  route: string | null;
  dosage_forms: string | null;
  typical_dosing: string | null;
  max_dose: string | null;
  contraindications: string | null;
  interactions: string | null;
  warnings: string | null;
  orthopedic_uses: string | null;
  created_at: string;
  updated_at: string;
};

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value) && value.length === 0) return null;
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export class CodeLookupManager {
  private db = getStorage().getDatabase();

  // ============================================================
  // ICD-10 CODES
  // ============================================================

  searchICD10(query: string, options: CodeSearchOptions = {}): ICD10Code[] {
    const limit = options.limit || 20;
    const normalized = query.replace(/[_]+/g, ' ');
    const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
    const ftsQuery = tokens.map(t => t.replace(/"/g, '""')).join(' OR ');

    if (!ftsQuery) return [];

    let sql = `
      SELECT c.*, bm25(f) as score
      FROM icd10_fts f
      JOIN icd10_codes c ON c.code = f.code
      WHERE f.icd10_fts MATCH ?
    `;
    const params: Array<string | number> = [ftsQuery];

    if (options.category) {
      sql += ' AND c.category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY score ASC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbICD10Row[];
    return rows.map(row => this.mapICD10(row));
  }

  getICD10(code: string): ICD10Code | null {
    const row = this.db.prepare('SELECT * FROM icd10_codes WHERE code = ?').get(code) as DbICD10Row | undefined;
    return row ? this.mapICD10(row) : null;
  }

  addICD10(input: ICD10Input): ICD10Code {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO icd10_codes
      (code, short_description, long_description, category, chapter, is_billable, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.code,
      input.short_description,
      input.long_description || null,
      input.category || null,
      input.chapter || null,
      input.is_billable !== false ? 1 : 0,
      new Date().toISOString()
    );

    return this.getICD10(input.code)!;
  }

  bulkAddICD10(codes: ICD10Input[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO icd10_codes
      (code, short_description, long_description, category, chapter, is_billable, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let count = 0;

    const transaction = this.db.transaction(() => {
      for (const input of codes) {
        stmt.run(
          input.code,
          input.short_description,
          input.long_description || null,
          input.category || null,
          input.chapter || null,
          input.is_billable !== false ? 1 : 0,
          now
        );
        count++;
      }
    });

    transaction();
    return count;
  }

  private mapICD10(row: DbICD10Row): ICD10Code {
    return {
      code: row.code,
      short_description: row.short_description,
      long_description: row.long_description,
      category: row.category,
      chapter: row.chapter,
      is_billable: row.is_billable === 1,
      created_at: row.created_at
    };
  }

  // ============================================================
  // CPT CODES
  // ============================================================

  searchCPT(query: string, options: CodeSearchOptions = {}): CPTCode[] {
    const limit = options.limit || 20;
    const normalized = query.replace(/[_]+/g, ' ');
    const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
    const ftsQuery = tokens.map(t => t.replace(/"/g, '""')).join(' OR ');

    if (!ftsQuery) return [];

    let sql = `
      SELECT c.*, bm25(f) as score
      FROM cpt_fts f
      JOIN cpt_codes c ON c.code = f.code
      WHERE f.cpt_fts MATCH ?
    `;
    const params: Array<string | number> = [ftsQuery];

    if (options.category) {
      sql += ' AND c.category = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY score ASC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbCPTRow[];
    return rows.map(row => this.mapCPT(row));
  }

  getCPT(code: string): CPTCode | null {
    const row = this.db.prepare('SELECT * FROM cpt_codes WHERE code = ?').get(code) as DbCPTRow | undefined;
    return row ? this.mapCPT(row) : null;
  }

  addCPT(input: CPTInput): CPTCode {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cpt_codes
      (code, description, long_description, category, subcategory, relative_value_units, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.code,
      input.description,
      input.long_description || null,
      input.category || null,
      input.subcategory || null,
      input.relative_value_units || null,
      new Date().toISOString()
    );

    return this.getCPT(input.code)!;
  }

  bulkAddCPT(codes: CPTInput[]): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cpt_codes
      (code, description, long_description, category, subcategory, relative_value_units, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let count = 0;

    const transaction = this.db.transaction(() => {
      for (const input of codes) {
        stmt.run(
          input.code,
          input.description,
          input.long_description || null,
          input.category || null,
          input.subcategory || null,
          input.relative_value_units || null,
          now
        );
        count++;
      }
    });

    transaction();
    return count;
  }

  private mapCPT(row: DbCPTRow): CPTCode {
    return {
      code: row.code,
      description: row.description,
      long_description: row.long_description,
      category: row.category,
      subcategory: row.subcategory,
      relative_value_units: row.relative_value_units,
      created_at: row.created_at
    };
  }

  // ============================================================
  // DRUG FORMULARY
  // ============================================================

  searchDrugs(query: string, options: CodeSearchOptions = {}): Drug[] {
    const limit = options.limit || 20;
    const normalized = query.replace(/[_]+/g, ' ');
    const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
    const ftsQuery = tokens.map(t => t.replace(/"/g, '""')).join(' OR ');

    if (!ftsQuery) return [];

    let sql = `
      SELECT d.*, bm25(f) as score
      FROM drug_fts f
      JOIN drug_formulary d ON d.id = f.id
      WHERE f.drug_fts MATCH ?
    `;
    const params: Array<string | number> = [ftsQuery];

    if (options.category) {
      sql += ' AND d.drug_class = ?';
      params.push(options.category);
    }

    sql += ' ORDER BY score ASC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbDrugRow[];
    return rows.map(row => this.mapDrug(row));
  }

  getDrug(id: string): Drug | null {
    const row = this.db.prepare('SELECT * FROM drug_formulary WHERE id = ?').get(id) as DbDrugRow | undefined;
    return row ? this.mapDrug(row) : null;
  }

  getDrugByName(name: string): Drug | null {
    const row = this.db.prepare(
      'SELECT * FROM drug_formulary WHERE name = ? OR generic_name = ?'
    ).get(name, name) as DbDrugRow | undefined;
    return row ? this.mapDrug(row) : null;
  }

  addDrug(input: DrugInput): Drug {
    const id = generateId('drug');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO drug_formulary
      (id, name, generic_name, brand_names, drug_class, route, dosage_forms,
       typical_dosing, max_dose, contraindications, interactions, warnings,
       orthopedic_uses, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.generic_name || null,
      stringify(input.brand_names || []),
      input.drug_class || null,
      input.route || null,
      stringify(input.dosage_forms || []),
      input.typical_dosing || null,
      input.max_dose || null,
      stringify(input.contraindications || []),
      stringify(input.interactions || []),
      stringify(input.warnings || []),
      stringify(input.orthopedic_uses || []),
      now,
      now
    );

    return this.getDrug(id)!;
  }

  bulkAddDrugs(drugs: DrugInput[]): number {
    const stmt = this.db.prepare(`
      INSERT INTO drug_formulary
      (id, name, generic_name, brand_names, drug_class, route, dosage_forms,
       typical_dosing, max_dose, contraindications, interactions, warnings,
       orthopedic_uses, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    let count = 0;

    const transaction = this.db.transaction(() => {
      for (const input of drugs) {
        const id = generateId('drug');
        stmt.run(
          id,
          input.name,
          input.generic_name || null,
          stringify(input.brand_names || []),
          input.drug_class || null,
          input.route || null,
          stringify(input.dosage_forms || []),
          input.typical_dosing || null,
          input.max_dose || null,
          stringify(input.contraindications || []),
          stringify(input.interactions || []),
          stringify(input.warnings || []),
          stringify(input.orthopedic_uses || []),
          now,
          now
        );
        count++;
      }
    });

    transaction();
    return count;
  }

  private mapDrug(row: DbDrugRow): Drug {
    return {
      id: row.id,
      name: row.name,
      generic_name: row.generic_name,
      brand_names: parseJson<string[]>(row.brand_names) || [],
      drug_class: row.drug_class,
      route: row.route,
      dosage_forms: parseJson<string[]>(row.dosage_forms) || [],
      typical_dosing: row.typical_dosing,
      max_dose: row.max_dose,
      contraindications: parseJson<string[]>(row.contraindications) || [],
      interactions: parseJson<string[]>(row.interactions) || [],
      warnings: parseJson<string[]>(row.warnings) || [],
      orthopedic_uses: parseJson<string[]>(row.orthopedic_uses) || [],
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

let sharedCodeLookupManager: CodeLookupManager | null = null;

export function getCodeLookupManager(): CodeLookupManager {
  if (!sharedCodeLookupManager) {
    sharedCodeLookupManager = new CodeLookupManager();
  }
  return sharedCodeLookupManager;
}
