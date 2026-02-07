import { createHash } from 'crypto';
import { getStorage } from '@/app/lib/memory';
import { getKnowledgeManager } from './index';
import { CochraneClient } from './evidence/cochraneClient';
import { PubMedClient } from './evidence/pubmedClient';
import { classifyEvidence, evidenceLevelToOrdinal } from './evidence/ranking';
import { DEFAULT_GUIDELINE_TEMPLATES, DEFAULT_KNOWLEDGE_SOURCES, DEFAULT_REFERENCE_ITEMS } from './defaultSources';
import type {
  ClinicalReferenceCategory,
  ClinicalReferenceItem,
  EvidenceRecord,
  EvidenceSearchOptions,
  ExternalEvidenceRecord,
  KnowledgeSource,
  KnowledgeSourceCategory,
  KnowledgeStoragePolicy,
  KnowledgeSyncJob,
  KnowledgeSyncJobType,
  SyncJobResult,
} from './phase5Types';

type DbKnowledgeSourceRow = {
  id: string;
  source_key: string;
  name: string;
  authority: string | null;
  category: KnowledgeSourceCategory;
  source_type: string;
  endpoint: string | null;
  enabled: number;
  sync_cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbKnowledgeSyncJobRow = {
  id: string;
  job_type: KnowledgeSyncJobType;
  source_key: string | null;
  status: KnowledgeSyncJob['status'];
  payload: string | null;
  attempt_count: number;
  cursor_from: string | null;
  cursor_to: string | null;
  records_fetched: number;
  records_ingested: number;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbEvidenceRow = {
  id: string;
  source_key: string;
  external_id: string;
  title: string;
  abstract_text: string | null;
  url: string | null;
  journal: string | null;
  authors: string | null;
  publication_date: string | null;
  publication_types: string | null;
  study_type: string | null;
  evidence_level: EvidenceRecord['evidence_level'];
  evidence_score: number;
  keywords: string | null;
  raw_payload: string | null;
  created_at: string;
  updated_at: string;
};

type DbReferenceRow = {
  id: string;
  category: ClinicalReferenceCategory;
  name: string;
  summary: string;
  indications: string | null;
  contraindications: string | null;
  metadata_json: string | null;
  source: string | null;
  version: string | null;
  created_at: string;
  updated_at: string;
};

type DbStoragePolicyRow = {
  id: string;
  max_chunk_characters: number;
  max_evidence_records: number;
  retention_days: number;
  updated_at: string;
};

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function stringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function hashContent(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

function toFtsQuery(query: string): string {
  const normalized = query.replace(/[_]+/g, ' ');
  const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
  const uniqueTokens = Array.from(new Set(tokens.map(term => term.trim()).filter(Boolean)));
  return uniqueTokens.map(term => term.replace(/"/g, '""')).join(' OR ');
}

function getMostRecentDate(values: Array<string | null>): string | null {
  const valid = values
    .map(value => (value ? new Date(value) : null))
    .filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())))
    .sort((a, b) => b.getTime() - a.getTime());
  return valid[0] ? valid[0].toISOString() : null;
}

export class ClinicalKnowledgeBaseManager {
  private db = getStorage().getDatabase();
  private knowledgeManager = getKnowledgeManager();
  private pubmed = new PubMedClient(process.env.PUBMED_API_KEY || null);
  private cochrane = new CochraneClient(process.env.PUBMED_API_KEY || null);
  private defaultsReady = false;

  private ensureDefaults(): void {
    if (this.defaultsReady) return;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_sources
      (id, source_key, name, authority, category, source_type, endpoint, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(source_key) DO UPDATE SET
        name = excluded.name,
        authority = excluded.authority,
        category = excluded.category,
        source_type = excluded.source_type,
        endpoint = COALESCE(excluded.endpoint, knowledge_sources.endpoint),
        updated_at = excluded.updated_at
    `);

    for (const source of DEFAULT_KNOWLEDGE_SOURCES) {
      stmt.run(
        `src_${source.source_key}`,
        source.source_key,
        source.name,
        source.authority,
        source.category,
        source.source_type,
        source.endpoint || null,
        now,
        now
      );
    }

    this.defaultsReady = true;
  }

  listSources(category?: KnowledgeSourceCategory): KnowledgeSource[] {
    this.ensureDefaults();

    if (category) {
      const rows = this.db.prepare(`
        SELECT * FROM knowledge_sources
        WHERE category = ?
        ORDER BY source_key ASC
      `).all(category) as DbKnowledgeSourceRow[];
      return rows.map(row => this.mapSource(row));
    }

    const rows = this.db.prepare(`
      SELECT * FROM knowledge_sources
      ORDER BY category ASC, source_key ASC
    `).all() as DbKnowledgeSourceRow[];
    return rows.map(row => this.mapSource(row));
  }

  setSourceEnabled(sourceKey: string, enabled: boolean): KnowledgeSource | null {
    this.ensureDefaults();
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE knowledge_sources
      SET enabled = ?, updated_at = ?
      WHERE source_key = ?
    `).run(enabled ? 1 : 0, now, sourceKey);

    if (result.changes === 0) return null;
    return this.getSource(sourceKey);
  }

  getSource(sourceKey: string): KnowledgeSource | null {
    this.ensureDefaults();
    const row = this.db.prepare(`
      SELECT * FROM knowledge_sources
      WHERE source_key = ?
    `).get(sourceKey) as DbKnowledgeSourceRow | undefined;
    return row ? this.mapSource(row) : null;
  }

  async seedGuidelineTemplates(force = false): Promise<{ ingested: number; skipped: number }> {
    this.ensureDefaults();
    let ingested = 0;
    let skipped = 0;
    const now = new Date().toISOString();

    for (const template of DEFAULT_GUIDELINE_TEMPLATES) {
      const contentHash = hashContent(template.content);
      const existing = this.db.prepare(`
        SELECT id, content_hash, document_id
        FROM knowledge_guideline_versions
        WHERE guideline_key = ? AND version = ?
      `).get(template.guidelineKey, template.version) as
        | { id: string; content_hash: string; document_id: string | null }
        | undefined;

      if (existing && existing.content_hash === contentHash && !force) {
        skipped += 1;
        continue;
      }

      const document = await this.knowledgeManager.ingestDocument({
        title: template.title,
        content: template.content,
        source: template.source,
        version: template.version,
        subspecialty: template.subspecialty,
        diagnosisTags: template.diagnosisTags,
        contentType: 'guideline',
        publishedAt: template.publishedAt || null,
      });

      this.db.prepare(`
        UPDATE knowledge_guideline_versions
        SET is_current = 0
        WHERE guideline_key = ?
      `).run(template.guidelineKey);

      this.db.prepare(`
        INSERT INTO knowledge_guideline_versions
        (id, guideline_key, version, title, document_id, content_hash, published_at, is_current, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(guideline_key, version) DO UPDATE SET
          title = excluded.title,
          document_id = excluded.document_id,
          content_hash = excluded.content_hash,
          published_at = excluded.published_at,
          is_current = 1
      `).run(
        existing?.id || generateId('gver'),
        template.guidelineKey,
        template.version,
        template.title,
        document.id,
        contentHash,
        template.publishedAt || null,
        now
      );

      ingested += 1;
    }

    return { ingested, skipped };
  }

  seedReferenceItems(force = false): { inserted: number; updated: number; skipped: number } {
    this.ensureDefaults();
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of DEFAULT_REFERENCE_ITEMS) {
      const existing = this.db.prepare(`
        SELECT id, summary, indications, contraindications, metadata_json, version
        FROM clinical_reference_items
        WHERE category = ? AND name = ?
      `).get(item.category, item.name) as
        | {
            id: string;
            summary: string;
            indications: string | null;
            contraindications: string | null;
            metadata_json: string | null;
            version: string | null;
          }
        | undefined;

      const metadataJson = stringify(item.metadata || null);
      if (
        existing &&
        !force &&
        existing.summary === item.summary &&
        (existing.indications || null) === item.indications &&
        (existing.contraindications || null) === item.contraindications &&
        (existing.metadata_json || null) === metadataJson &&
        (existing.version || null) === item.version
      ) {
        skipped += 1;
        continue;
      }

      if (existing) {
        this.db.prepare(`
          UPDATE clinical_reference_items
          SET
            summary = ?,
            indications = ?,
            contraindications = ?,
            metadata_json = ?,
            source = ?,
            version = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          item.summary,
          item.indications,
          item.contraindications,
          metadataJson,
          item.source,
          item.version,
          now,
          existing.id
        );
        updated += 1;
      } else {
        this.db.prepare(`
          INSERT INTO clinical_reference_items
          (id, category, name, summary, indications, contraindications, metadata_json, source, version, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          generateId('ref'),
          item.category,
          item.name,
          item.summary,
          item.indications,
          item.contraindications,
          metadataJson,
          item.source,
          item.version,
          now,
          now
        );
        inserted += 1;
      }
    }

    return { inserted, updated, skipped };
  }

  listSyncJobs(limit = 50): KnowledgeSyncJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM knowledge_sync_jobs
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as DbKnowledgeSyncJobRow[];

    return rows.map(row => this.mapJob(row));
  }

  enqueueSyncJob(input: {
    jobType: KnowledgeSyncJobType;
    sourceKey?: string | null;
    payload?: Record<string, unknown>;
    scheduledAt?: string;
  }): KnowledgeSyncJob {
    this.ensureDefaults();
    const now = new Date().toISOString();
    const id = generateId('kjob');

    this.db.prepare(`
      INSERT INTO knowledge_sync_jobs
      (id, job_type, source_key, status, payload, attempt_count, records_fetched, records_ingested, scheduled_at, created_at, updated_at)
      VALUES (?, ?, ?, 'queued', ?, 0, 0, 0, ?, ?, ?)
    `).run(
      id,
      input.jobType,
      input.sourceKey || null,
      stringify(input.payload || null),
      input.scheduledAt || now,
      now,
      now
    );

    return this.getJob(id)!;
  }

  getJob(jobId: string): KnowledgeSyncJob | null {
    const row = this.db.prepare(`
      SELECT * FROM knowledge_sync_jobs
      WHERE id = ?
    `).get(jobId) as DbKnowledgeSyncJobRow | undefined;
    return row ? this.mapJob(row) : null;
  }

  async processNextSyncJob(): Promise<SyncJobResult> {
    this.ensureDefaults();
    const next = this.db.prepare(`
      SELECT * FROM knowledge_sync_jobs
      WHERE status = 'queued'
      ORDER BY scheduled_at ASC, created_at ASC
      LIMIT 1
    `).get() as DbKnowledgeSyncJobRow | undefined;

    if (!next) {
      return {
        job: {
          id: '',
          job_type: 'cleanup',
          source_key: null,
          status: 'completed',
          payload: null,
          attempt_count: 0,
          cursor_from: null,
          cursor_to: null,
          records_fetched: 0,
          records_ingested: 0,
          error_message: null,
          scheduled_at: new Date().toISOString(),
          started_at: null,
          finished_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        processed: false,
        message: 'No queued sync jobs',
      };
    }

    const startedAt = new Date().toISOString();
    this.db.prepare(`
      UPDATE knowledge_sync_jobs
      SET status = 'running', started_at = ?, updated_at = ?, attempt_count = attempt_count + 1
      WHERE id = ?
    `).run(startedAt, startedAt, next.id);

    let recordsFetched = 0;
    let recordsIngested = 0;
    let cursorTo: string | null = null;
    let message = 'Sync job processed';

    try {
      const payload = parseJson<Record<string, unknown>>(next.payload) || {};

      if (next.job_type === 'guideline_seed') {
        const force = Boolean(payload.force);
        const seeded = await this.seedGuidelineTemplates(force);
        const refs = this.seedReferenceItems(force);
        recordsFetched = seeded.ingested + seeded.skipped + refs.inserted + refs.updated + refs.skipped;
        recordsIngested = seeded.ingested + refs.inserted + refs.updated;
        message = `Guidelines seeded: ${seeded.ingested}, references updated: ${refs.inserted + refs.updated}`;
      } else if (next.job_type === 'evidence_sync') {
        const query = typeof payload.query === 'string' && payload.query.trim()
          ? payload.query.trim()
          : 'orthopedic treatment outcomes';
        const maxResults = typeof payload.maxResults === 'number'
          ? Math.max(1, Math.min(payload.maxResults, 25))
          : 10;
        const sourceKey = next.source_key || (typeof payload.sourceKey === 'string' ? payload.sourceKey : 'pubmed');
        const source = this.getSource(sourceKey);
        if (!source || !source.enabled) {
          throw new Error(`Source '${sourceKey}' is unavailable or disabled`);
        }

        const syncResult = await this.syncEvidence({
          sourceKey,
          query,
          maxResults,
          sinceDate: source.sync_cursor,
        });
        recordsFetched = syncResult.fetched;
        recordsIngested = syncResult.ingested;
        cursorTo = syncResult.cursorTo;
        message = `Evidence synced from ${sourceKey}: ${recordsIngested}/${recordsFetched}`;
      } else if (next.job_type === 'cleanup') {
        const cleanup = await this.enforceStoragePolicy();
        recordsFetched = cleanup.documentsDeleted + cleanup.evidenceDeleted + cleanup.jobsDeleted;
        recordsIngested = recordsFetched;
        message = 'Storage cleanup completed';
      }

      const finishedAt = new Date().toISOString();
      this.db.prepare(`
        UPDATE knowledge_sync_jobs
        SET
          status = 'completed',
          records_fetched = ?,
          records_ingested = ?,
          cursor_to = ?,
          error_message = NULL,
          finished_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(recordsFetched, recordsIngested, cursorTo, finishedAt, finishedAt, next.id);

      return {
        job: this.getJob(next.id)!,
        processed: true,
        message,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.db.prepare(`
        UPDATE knowledge_sync_jobs
        SET
          status = 'failed',
          error_message = ?,
          finished_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(errorMessage, finishedAt, finishedAt, next.id);

      return {
        job: this.getJob(next.id)!,
        processed: true,
        message: errorMessage,
      };
    }
  }

  async syncEvidence(params: {
    sourceKey: string;
    query: string;
    maxResults?: number;
    sinceDate?: string | null;
  }): Promise<{ fetched: number; ingested: number; cursorTo: string | null }> {
    this.ensureDefaults();
    const source = this.getSource(params.sourceKey);
    if (!source) {
      throw new Error(`Unknown evidence source: ${params.sourceKey}`);
    }
    if (!source.enabled) {
      throw new Error(`Evidence source is disabled: ${params.sourceKey}`);
    }

    const sourceType = source.source_type;
    if (sourceType !== 'pubmed' && sourceType !== 'cochrane') {
      throw new Error(`Source ${params.sourceKey} does not support evidence sync`);
    }

    const externalRecords = sourceType === 'pubmed'
      ? await this.pubmed.search(params.query, {
          maxResults: params.maxResults,
          sinceDate: params.sinceDate || undefined,
        })
      : await this.cochrane.search(params.query, {
          maxResults: params.maxResults,
          sinceDate: params.sinceDate || undefined,
        });

    const ingested = this.upsertExternalEvidence(params.sourceKey, externalRecords);
    const cursorTo = getMostRecentDate(externalRecords.map(record => record.publicationDate || null));
    const now = new Date().toISOString();

    this.db.prepare(`
      UPDATE knowledge_sources
      SET
        sync_cursor = ?,
        last_synced_at = ?,
        updated_at = ?
      WHERE source_key = ?
    `).run(cursorTo || source.sync_cursor, now, now, params.sourceKey);

    return {
      fetched: externalRecords.length,
      ingested,
      cursorTo: cursorTo || source.sync_cursor,
    };
  }

  private upsertExternalEvidence(sourceKey: string, records: ExternalEvidenceRecord[]): number {
    if (records.length === 0) return 0;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_evidence
      (id, source_key, external_id, title, abstract_text, url, journal, authors, publication_date, publication_types, study_type, evidence_level, evidence_score, keywords, raw_payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_key, external_id) DO UPDATE SET
        title = excluded.title,
        abstract_text = excluded.abstract_text,
        url = excluded.url,
        journal = excluded.journal,
        authors = excluded.authors,
        publication_date = excluded.publication_date,
        publication_types = excluded.publication_types,
        study_type = excluded.study_type,
        evidence_level = excluded.evidence_level,
        evidence_score = excluded.evidence_score,
        keywords = excluded.keywords,
        raw_payload = excluded.raw_payload,
        updated_at = excluded.updated_at
    `);

    for (const record of records) {
      const classification = classifyEvidence({
        publicationTypes: record.publicationTypes,
        title: record.title,
        abstractText: record.abstractText,
        publicationDate: record.publicationDate || null,
      });

      const id = `ev_${hashContent(`${sourceKey}:${record.externalId}`).slice(0, 16)}`;
      stmt.run(
        id,
        sourceKey,
        record.externalId,
        record.title,
        record.abstractText || null,
        record.url || null,
        record.journal || null,
        stringify(record.authors),
        record.publicationDate || null,
        stringify(record.publicationTypes),
        classification.studyType,
        classification.evidenceLevel,
        classification.evidenceScore,
        stringify(record.keywords),
        stringify(record.rawPayload || null),
        now,
        now
      );
    }

    return records.length;
  }

  async searchEvidence(query: string, options: EvidenceSearchOptions = {}): Promise<EvidenceRecord[]> {
    this.ensureDefaults();
    const limit = Math.max(1, Math.min(options.limit || 8, 20));
    const ftsQuery = toFtsQuery(query);

    if (!ftsQuery) return [];

    if (options.includeRemote) {
      const maxResults = Math.max(3, Math.min(limit, 12));
      if (options.sourceKey) {
        const source = this.getSource(options.sourceKey);
        if (source?.enabled && source.category === 'evidence') {
          await this.syncEvidence({
            sourceKey: options.sourceKey,
            query,
            maxResults,
            sinceDate: source.sync_cursor,
          });
        }
      } else {
        const activeSources = this.listSources('evidence').filter(source => source.enabled);
        await Promise.all(
          activeSources.map(source =>
            this.syncEvidence({
              sourceKey: source.source_key,
              query,
              maxResults: Math.max(3, Math.floor(maxResults / activeSources.length) || 3),
              sinceDate: source.sync_cursor,
            }).catch(() => null)
          )
        );
      }
    }

    let sql = `
      SELECT e.*
      FROM knowledge_evidence_fts f
      JOIN knowledge_evidence e ON e.id = f.evidence_id
      WHERE knowledge_evidence_fts MATCH ?
    `;
    const params: Array<string | number> = [ftsQuery];

    if (options.sourceKey) {
      sql += ` AND e.source_key = ?`;
      params.push(options.sourceKey);
    }

    if (options.minEvidenceLevel) {
      sql += ` AND CAST(SUBSTR(e.evidence_level, 7) AS INTEGER) <= ?`;
      params.push(evidenceLevelToOrdinal(options.minEvidenceLevel));
    }

    sql += ` ORDER BY e.evidence_score DESC, e.publication_date DESC, bm25(knowledge_evidence_fts) ASC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbEvidenceRow[];
    return rows.map(row => this.mapEvidence(row));
  }

  searchReferenceItems(
    query: string,
    options: { limit?: number; category?: ClinicalReferenceCategory } = {}
  ): ClinicalReferenceItem[] {
    const limit = Math.max(1, Math.min(options.limit || 8, 25));
    const ftsQuery = toFtsQuery(query);

    if (!ftsQuery) {
      if (options.category) {
        const rows = this.db.prepare(`
          SELECT * FROM clinical_reference_items
          WHERE category = ?
          ORDER BY updated_at DESC
          LIMIT ?
        `).all(options.category, limit) as DbReferenceRow[];
        return rows.map(row => this.mapReference(row));
      }

      const rows = this.db.prepare(`
        SELECT * FROM clinical_reference_items
        ORDER BY updated_at DESC
        LIMIT ?
      `).all(limit) as DbReferenceRow[];
      return rows.map(row => this.mapReference(row));
    }

    let sql = `
      SELECT r.*
      FROM clinical_reference_items_fts f
      JOIN clinical_reference_items r ON r.id = f.item_id
      WHERE clinical_reference_items_fts MATCH ?
    `;
    const params: Array<string | number> = [ftsQuery];

    if (options.category) {
      sql += ` AND r.category = ?`;
      params.push(options.category);
    }

    sql += ` ORDER BY bm25(clinical_reference_items_fts) ASC, r.updated_at DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as DbReferenceRow[];
    return rows.map(row => this.mapReference(row));
  }

  upsertReferenceItems(items: Array<Omit<ClinicalReferenceItem, 'id' | 'created_at' | 'updated_at'>>): number {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO clinical_reference_items
      (id, category, name, summary, indications, contraindications, metadata_json, source, version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStmt = this.db.prepare(`
      UPDATE clinical_reference_items
      SET summary = ?, indications = ?, contraindications = ?, metadata_json = ?, source = ?, version = ?, updated_at = ?
      WHERE id = ?
    `);

    let affected = 0;
    const transaction = this.db.transaction(() => {
      for (const item of items) {
        const existing = this.db.prepare(`
          SELECT id FROM clinical_reference_items
          WHERE category = ? AND name = ?
        `).get(item.category, item.name) as { id: string } | undefined;

        if (existing) {
          updateStmt.run(
            item.summary,
            item.indications || null,
            item.contraindications || null,
            stringify(item.metadata_json || null),
            item.source || null,
            item.version || null,
            now,
            existing.id
          );
        } else {
          stmt.run(
            generateId('ref'),
            item.category,
            item.name,
            item.summary,
            item.indications || null,
            item.contraindications || null,
            stringify(item.metadata_json || null),
            item.source || null,
            item.version || null,
            now,
            now
          );
        }
        affected += 1;
      }
    });

    transaction();
    return affected;
  }

  getStoragePolicy(): KnowledgeStoragePolicy {
    const row = this.db.prepare(`
      SELECT * FROM knowledge_storage_policy WHERE id = 'default'
    `).get() as DbStoragePolicyRow | undefined;

    if (row) {
      return this.mapStoragePolicy(row);
    }

    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO knowledge_storage_policy (id, max_chunk_characters, max_evidence_records, retention_days, updated_at)
      VALUES ('default', 1500000, 5000, 365, ?)
    `).run(now);

    return {
      id: 'default',
      max_chunk_characters: 1500000,
      max_evidence_records: 5000,
      retention_days: 365,
      updated_at: now,
    };
  }

  updateStoragePolicy(patch: Partial<KnowledgeStoragePolicy>): KnowledgeStoragePolicy {
    const current = this.getStoragePolicy();
    const next: KnowledgeStoragePolicy = {
      ...current,
      max_chunk_characters: patch.max_chunk_characters ?? current.max_chunk_characters,
      max_evidence_records: patch.max_evidence_records ?? current.max_evidence_records,
      retention_days: patch.retention_days ?? current.retention_days,
      updated_at: new Date().toISOString(),
    };

    this.db.prepare(`
      UPDATE knowledge_storage_policy
      SET max_chunk_characters = ?, max_evidence_records = ?, retention_days = ?, updated_at = ?
      WHERE id = 'default'
    `).run(
      next.max_chunk_characters,
      next.max_evidence_records,
      next.retention_days,
      next.updated_at
    );

    return next;
  }

  async enforceStoragePolicy(): Promise<{ documentsDeleted: number; evidenceDeleted: number; jobsDeleted: number }> {
    const policy = this.getStoragePolicy();
    let documentsDeleted = 0;
    let evidenceDeleted = 0;
    let jobsDeleted = 0;

    const chunkUsage = this.db.prepare(`
      SELECT COALESCE(SUM(LENGTH(content)), 0) as total_chars
      FROM knowledge_chunks
    `).get() as { total_chars: number };

    if (chunkUsage.total_chars > policy.max_chunk_characters) {
      const candidates = this.db.prepare(`
        SELECT d.id, COALESCE(SUM(LENGTH(c.content)), 0) as char_count
        FROM knowledge_documents d
        JOIN knowledge_chunks c ON c.document_id = d.id
        LEFT JOIN knowledge_guideline_versions gv
          ON gv.document_id = d.id AND gv.is_current = 1
        WHERE gv.document_id IS NULL
        GROUP BY d.id
        ORDER BY d.updated_at ASC
      `).all() as Array<{ id: string; char_count: number }>;

      let runningChars = chunkUsage.total_chars;
      for (const candidate of candidates) {
        if (runningChars <= policy.max_chunk_characters) break;
        const deleted = this.knowledgeManager.deleteDocument(candidate.id);
        if (deleted) {
          documentsDeleted += 1;
          runningChars -= candidate.char_count;
        }
      }
    }

    const evidenceCountRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM knowledge_evidence
    `).get() as { count: number };
    const evidenceExcess = Math.max(0, evidenceCountRow.count - policy.max_evidence_records);

    if (evidenceExcess > 0) {
      const result = this.db.prepare(`
        DELETE FROM knowledge_evidence
        WHERE id IN (
          SELECT id FROM knowledge_evidence
          ORDER BY evidence_score ASC, COALESCE(publication_date, created_at) ASC
          LIMIT ?
        )
      `).run(evidenceExcess);
      evidenceDeleted += result.changes;
    }

    const retentionCutoff = new Date(Date.now() - policy.retention_days * 24 * 60 * 60 * 1000).toISOString();
    const oldEvidenceDeleted = this.db.prepare(`
      DELETE FROM knowledge_evidence
      WHERE COALESCE(publication_date, created_at) < ?
    `).run(retentionCutoff).changes;
    evidenceDeleted += oldEvidenceDeleted;

    jobsDeleted = this.db.prepare(`
      DELETE FROM knowledge_sync_jobs
      WHERE status IN ('completed', 'failed')
        AND COALESCE(finished_at, updated_at) < ?
    `).run(retentionCutoff).changes;

    return { documentsDeleted, evidenceDeleted, jobsDeleted };
  }

  private mapSource(row: DbKnowledgeSourceRow): KnowledgeSource {
    return {
      id: row.id,
      source_key: row.source_key,
      name: row.name,
      authority: row.authority,
      category: row.category,
      source_type: row.source_type as KnowledgeSource['source_type'],
      endpoint: row.endpoint,
      enabled: row.enabled === 1,
      sync_cursor: row.sync_cursor,
      last_synced_at: row.last_synced_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapJob(row: DbKnowledgeSyncJobRow): KnowledgeSyncJob {
    return {
      id: row.id,
      job_type: row.job_type,
      source_key: row.source_key,
      status: row.status,
      payload: parseJson<Record<string, unknown>>(row.payload),
      attempt_count: row.attempt_count,
      cursor_from: row.cursor_from,
      cursor_to: row.cursor_to,
      records_fetched: row.records_fetched,
      records_ingested: row.records_ingested,
      error_message: row.error_message,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      finished_at: row.finished_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapEvidence(row: DbEvidenceRow): EvidenceRecord {
    return {
      id: row.id,
      source_key: row.source_key,
      external_id: row.external_id,
      title: row.title,
      abstract_text: row.abstract_text,
      url: row.url,
      journal: row.journal,
      authors: parseJson<string[]>(row.authors) || [],
      publication_date: row.publication_date,
      publication_types: parseJson<string[]>(row.publication_types) || [],
      study_type: row.study_type,
      evidence_level: row.evidence_level,
      evidence_score: row.evidence_score,
      keywords: parseJson<string[]>(row.keywords) || [],
      raw_payload: parseJson<Record<string, unknown>>(row.raw_payload),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapReference(row: DbReferenceRow): ClinicalReferenceItem {
    return {
      id: row.id,
      category: row.category,
      name: row.name,
      summary: row.summary,
      indications: row.indications,
      contraindications: row.contraindications,
      metadata_json: parseJson<Record<string, unknown>>(row.metadata_json),
      source: row.source,
      version: row.version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapStoragePolicy(row: DbStoragePolicyRow): KnowledgeStoragePolicy {
    return {
      id: row.id,
      max_chunk_characters: row.max_chunk_characters,
      max_evidence_records: row.max_evidence_records,
      retention_days: row.retention_days,
      updated_at: row.updated_at,
    };
  }
}

let sharedClinicalKnowledgeBase: ClinicalKnowledgeBaseManager | null = null;

export function getClinicalKnowledgeBase(): ClinicalKnowledgeBaseManager {
  if (!sharedClinicalKnowledgeBase) {
    sharedClinicalKnowledgeBase = new ClinicalKnowledgeBaseManager();
  }
  return sharedClinicalKnowledgeBase;
}
