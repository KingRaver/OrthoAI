import { getStorage } from '@/app/lib/memory';
import { createHash } from 'crypto';
import type {
  ImagingStudy,
  ImagingAnnotation,
  FindingTemplate,
  StudyComparison,
  StudyInput,
  AnnotationInput,
  StudySearchOptions,
  DicomMetadata,
  AnnotationData,
  AnnotationType
} from './types';

type DbStudyRow = {
  id: string;
  case_id: string | null;
  study_type: string;
  modality: string | null;
  body_part: string | null;
  laterality: 'left' | 'right' | 'bilateral' | null;
  study_date: string | null;
  description: string | null;
  file_path: string | null;
  dicom_metadata: string | null;
  findings: string | null;
  impression: string | null;
  created_at: string;
  updated_at: string;
};

type DbAnnotationRow = {
  id: string;
  study_id: string;
  annotation_type: string;
  label: string | null;
  data: string | null;
  created_at: string;
  updated_at: string;
};

type DbTemplateRow = {
  id: string;
  name: string;
  category: string | null;
  modality: string | null;
  body_part: string | null;
  template_text: string;
  variables: string | null;
  created_at: string;
};

type DbComparisonRow = {
  id: string;
  study_id_1: string;
  study_id_2: string;
  comparison_type: 'pre_post' | 'left_right' | 'serial' | null;
  notes: string | null;
  created_at: string;
};

const isAnnotationType = (value: string): value is AnnotationType =>
  value === 'length' ||
  value === 'angle' ||
  value === 'ellipse' ||
  value === 'rectangle' ||
  value === 'freehand' ||
  value === 'arrow' ||
  value === 'text' ||
  value === 'landmark';

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
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

export class ImagingManager {
  private db = getStorage().getDatabase();

  // ============================================================
  // IMAGING STUDIES
  // ============================================================

  listStudies(options: StudySearchOptions = {}): ImagingStudy[] {
    const limit = options.limit || 50;
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (options.case_id) {
      conditions.push('case_id = ?');
      params.push(options.case_id);
    }
    if (options.study_type) {
      conditions.push('study_type = ?');
      params.push(options.study_type);
    }
    if (options.modality) {
      conditions.push('modality = ?');
      params.push(options.modality);
    }
    if (options.body_part) {
      conditions.push('body_part = ?');
      params.push(options.body_part);
    }

    let sql = 'SELECT * FROM imaging_studies';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY study_date DESC, created_at DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbStudyRow[];
    return rows.map(row => this.mapStudy(row));
  }

  getStudy(id: string): ImagingStudy | null {
    const row = this.db.prepare('SELECT * FROM imaging_studies WHERE id = ?').get(id) as DbStudyRow | undefined;
    return row ? this.mapStudy(row) : null;
  }

  createStudy(input: StudyInput): ImagingStudy {
    const id = generateId('study');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO imaging_studies
      (id, case_id, study_type, modality, body_part, laterality, study_date,
       description, file_path, dicom_metadata, findings, impression, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.case_id || null,
      input.study_type,
      input.modality || null,
      input.body_part || null,
      input.laterality || null,
      input.study_date || null,
      input.description || null,
      input.file_path || null,
      stringify(input.dicom_metadata),
      input.findings || null,
      input.impression || null,
      now,
      now
    );

    return this.getStudy(id)!;
  }

  updateStudy(id: string, updates: Partial<StudyInput>): ImagingStudy | null {
    const existing = this.getStudy(id);
    if (!existing) return null;

    const stmt = this.db.prepare(`
      UPDATE imaging_studies SET
        case_id = ?,
        study_type = ?,
        modality = ?,
        body_part = ?,
        laterality = ?,
        study_date = ?,
        description = ?,
        file_path = ?,
        dicom_metadata = ?,
        findings = ?,
        impression = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.case_id !== undefined ? updates.case_id : existing.case_id,
      updates.study_type !== undefined ? updates.study_type : existing.study_type,
      updates.modality !== undefined ? updates.modality : existing.modality,
      updates.body_part !== undefined ? updates.body_part : existing.body_part,
      updates.laterality !== undefined ? updates.laterality : existing.laterality,
      updates.study_date !== undefined ? updates.study_date : existing.study_date,
      updates.description !== undefined ? updates.description : existing.description,
      updates.file_path !== undefined ? updates.file_path : existing.file_path,
      updates.dicom_metadata !== undefined
        ? stringify(updates.dicom_metadata)
        : stringify(existing.dicom_metadata),
      updates.findings !== undefined ? updates.findings : existing.findings,
      updates.impression !== undefined ? updates.impression : existing.impression,
      new Date().toISOString(),
      id
    );

    return this.getStudy(id);
  }

  deleteStudy(id: string): boolean {
    const result = this.db.prepare('DELETE FROM imaging_studies WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapStudy(row: DbStudyRow): ImagingStudy {
    return {
      id: row.id,
      case_id: row.case_id,
      study_type: row.study_type,
      modality: row.modality,
      body_part: row.body_part,
      laterality: row.laterality,
      study_date: row.study_date,
      description: row.description,
      file_path: row.file_path,
      dicom_metadata: parseJson<DicomMetadata>(row.dicom_metadata),
      findings: row.findings,
      impression: row.impression,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // ============================================================
  // ANNOTATIONS
  // ============================================================

  listAnnotations(studyId: string): ImagingAnnotation[] {
    const rows = this.db.prepare(
      'SELECT * FROM imaging_annotations WHERE study_id = ? ORDER BY created_at ASC'
    ).all(studyId) as DbAnnotationRow[];
    return rows.map(row => this.mapAnnotation(row));
  }

  getAnnotation(id: string): ImagingAnnotation | null {
    const row = this.db.prepare('SELECT * FROM imaging_annotations WHERE id = ?').get(id) as DbAnnotationRow | undefined;
    return row ? this.mapAnnotation(row) : null;
  }

  createAnnotation(input: AnnotationInput): ImagingAnnotation {
    const id = generateId('annot');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO imaging_annotations
      (id, study_id, annotation_type, label, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.study_id,
      input.annotation_type,
      input.label || null,
      stringify(input.data),
      now,
      now
    );

    return this.getAnnotation(id)!;
  }

  updateAnnotation(id: string, updates: Partial<Omit<AnnotationInput, 'study_id'>>): ImagingAnnotation | null {
    const existing = this.getAnnotation(id);
    if (!existing) return null;

    const stmt = this.db.prepare(`
      UPDATE imaging_annotations SET
        annotation_type = ?,
        label = ?,
        data = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      updates.annotation_type !== undefined ? updates.annotation_type : existing.annotation_type,
      updates.label !== undefined ? updates.label : existing.label,
      updates.data !== undefined ? stringify(updates.data) : stringify(existing.data),
      new Date().toISOString(),
      id
    );

    return this.getAnnotation(id);
  }

  deleteAnnotation(id: string): boolean {
    const result = this.db.prepare('DELETE FROM imaging_annotations WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private mapAnnotation(row: DbAnnotationRow): ImagingAnnotation {
    const annotationType: AnnotationType = isAnnotationType(row.annotation_type)
      ? row.annotation_type
      : 'text';
    return {
      id: row.id,
      study_id: row.study_id,
      annotation_type: annotationType,
      label: row.label,
      data: parseJson<AnnotationData>(row.data) || {},
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  // ============================================================
  // FINDING TEMPLATES
  // ============================================================

  listTemplates(options: { category?: string; modality?: string; body_part?: string } = {}): FindingTemplate[] {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (options.category) {
      conditions.push('category = ?');
      params.push(options.category);
    }
    if (options.modality) {
      conditions.push('modality = ?');
      params.push(options.modality);
    }
    if (options.body_part) {
      conditions.push('body_part = ?');
      params.push(options.body_part);
    }

    let sql = 'SELECT * FROM finding_templates';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY name ASC';

    const rows = this.db.prepare(sql).all(...params) as DbTemplateRow[];
    return rows.map(row => this.mapTemplate(row));
  }

  getTemplate(id: string): FindingTemplate | null {
    const row = this.db.prepare('SELECT * FROM finding_templates WHERE id = ?').get(id) as DbTemplateRow | undefined;
    return row ? this.mapTemplate(row) : null;
  }

  applyTemplate(templateId: string, variables: Record<string, string>): string | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    let result = template.template_text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  private mapTemplate(row: DbTemplateRow): FindingTemplate {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      modality: row.modality,
      body_part: row.body_part,
      template_text: row.template_text,
      variables: parseJson<string[]>(row.variables) || [],
      created_at: row.created_at
    };
  }

  // ============================================================
  // STUDY COMPARISONS
  // ============================================================

  createComparison(studyId1: string, studyId2: string, type?: 'pre_post' | 'left_right' | 'serial', notes?: string): StudyComparison {
    const id = generateId('comp');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO study_comparisons
      (id, study_id_1, study_id_2, comparison_type, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, studyId1, studyId2, type || null, notes || null, now);

    return this.getComparison(id)!;
  }

  getComparison(id: string): StudyComparison | null {
    const row = this.db.prepare('SELECT * FROM study_comparisons WHERE id = ?').get(id) as DbComparisonRow | undefined;
    return row ? this.mapComparison(row) : null;
  }

  listComparisonsForStudy(studyId: string): StudyComparison[] {
    const rows = this.db.prepare(
      'SELECT * FROM study_comparisons WHERE study_id_1 = ? OR study_id_2 = ? ORDER BY created_at DESC'
    ).all(studyId, studyId) as DbComparisonRow[];
    return rows.map(row => this.mapComparison(row));
  }

  private mapComparison(row: DbComparisonRow): StudyComparison {
    return {
      id: row.id,
      study_id_1: row.study_id_1,
      study_id_2: row.study_id_2,
      comparison_type: row.comparison_type,
      notes: row.notes,
      created_at: row.created_at
    };
  }
}

let sharedImagingManager: ImagingManager | null = null;

export function getImagingManager(): ImagingManager {
  if (!sharedImagingManager) {
    sharedImagingManager = new ImagingManager();
  }
  return sharedImagingManager;
}
