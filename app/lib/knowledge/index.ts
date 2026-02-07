import { getStorage } from '@/app/lib/memory';
import { getSharedEmbeddings } from '@/app/lib/memory/rag/embeddings';
import { ChromaRetrieval } from '@/app/lib/memory/rag/retrieval';
import { deduplicateAndRerank } from '@/app/lib/memory/rag/rerank';
import type { KnowledgeDocument, KnowledgeChunk, KnowledgeSearchResult } from './types';
import type { RetrievalResult } from '@/app/lib/memory/schemas';
import type { Where } from 'chromadb';
import { createHash } from 'crypto';

export interface KnowledgeIngestInput {
  title: string;
  content: string;
  source?: string | null;
  version?: string | null;
  subspecialty?: string | null;
  diagnosisTags?: string[];
  contentType?: string;
  publishedAt?: string | null;
}

export interface KnowledgeSearchOptions {
  limit?: number;
  subspecialty?: string;
  diagnosisTag?: string;
  documentId?: string;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

type DbKnowledgeDocumentRow = {
  id: string;
  title: string;
  source: string | null;
  version: string | null;
  subspecialty: string | null;
  diagnosis_tags: string | null;
  content_type: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type DbKnowledgeChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  created_at: string;
};

function chunkText(text: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP): string[] {
  if (!text.trim()) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= text.length) break;
  }
  return chunks;
}

function normalizeTags(tags?: string[]): string[] {
  return (tags || [])
    .map(tag => tag.trim())
    .filter(Boolean);
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

function generateId(prefix: string): string {
  const hash = createHash('sha1');
  hash.update(`${prefix}-${Date.now()}-${Math.random()}`);
  return `${prefix}_${hash.digest('hex').slice(0, 16)}`;
}

export class KnowledgeManager {
  private db = getStorage().getDatabase();
  private retrieval = new ChromaRetrieval(getSharedEmbeddings());
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.retrieval.initialize();
    this.initialized = true;
  }

  listDocuments(limit = 50, offset = 0): KnowledgeDocument[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_documents
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset) as DbKnowledgeDocumentRow[];
    return rows.map(row => this.mapDocument(row));
  }

  getDocument(documentId: string): KnowledgeDocument | null {
    const stmt = this.db.prepare(`SELECT * FROM knowledge_documents WHERE id = ?`);
    const row = stmt.get(documentId) as DbKnowledgeDocumentRow | undefined;
    if (!row) return null;
    return this.mapDocument(row);
  }

  deleteDocument(documentId: string): boolean {
    const chunks = this.listChunks(documentId);
    for (const chunk of chunks) {
      this.retrieval.deleteDocumentEmbedding(`knowledge_${chunk.id}`).catch(() => {});
    }
    const stmt = this.db.prepare(`DELETE FROM knowledge_documents WHERE id = ?`);
    const result = stmt.run(documentId);
    return result.changes > 0;
  }

  listChunks(documentId: string): KnowledgeChunk[] {
    const stmt = this.db.prepare(`
      SELECT * FROM knowledge_chunks
      WHERE document_id = ?
      ORDER BY chunk_index ASC
    `);
    const rows = stmt.all(documentId) as DbKnowledgeChunkRow[];
    return rows.map(row => this.mapChunk(row));
  }

  async ingestDocument(input: KnowledgeIngestInput): Promise<KnowledgeDocument> {
    await this.initialize();

    const id = generateId('doc');
    const now = new Date().toISOString();
    const diagnosisTags = normalizeTags(input.diagnosisTags);

    const stmt = this.db.prepare(`
      INSERT INTO knowledge_documents
      (id, title, source, version, subspecialty, diagnosis_tags, content_type, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.title,
      input.source || null,
      input.version || null,
      input.subspecialty || null,
      stringify(diagnosisTags),
      input.contentType || 'text',
      input.publishedAt || null,
      now,
      now
    );

    const chunks = chunkText(input.content);
    const chunkStmt = this.db.prepare(`
      INSERT INTO knowledge_chunks
      (id, document_id, chunk_index, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < chunks.length; i += 1) {
      const chunkId = generateId('chunk');
      const chunk = chunks[i];
      chunkStmt.run(chunkId, id, i, chunk, now);

      await this.retrieval.upsertDocumentEmbedding(`knowledge_${chunkId}`, chunk, {
        document_id: id,
        chunk_id: chunkId,
        chunk_index: i,
        title: input.title,
        subspecialty: input.subspecialty || null,
        diagnosis_tags: diagnosisTags.join(', '),
        content_type: 'knowledge_chunk',
        created_at: now
      });
    }

    return this.getDocument(id)!;
  }

  async search(query: string, options: KnowledgeSearchOptions = {}): Promise<KnowledgeSearchResult[]> {
    await this.initialize();

    const limit = options.limit || 8;
    const semanticPromise = this.semanticSearch(query, limit, options);
    const ftsPromise = this.ftsSearch(query, limit, options);

    const [semanticResults, ftsResults] = await Promise.all([semanticPromise, ftsPromise]);

    const merged = deduplicateAndRerank(semanticResults, ftsResults, query).slice(0, limit);

    const chunkIds = merged.map(result => result.message.id);
    const chunksById = this.getChunksByIds(chunkIds);

    const documentIds = Array.from(new Set(chunksById.map(chunk => chunk.document_id)));
    const documentsById = this.getDocumentsByIds(documentIds);

    let results = merged
      .map(result => {
        const chunk = chunksById.find(c => c.id === result.message.id);
        if (!chunk) return null;
        const document = documentsById.find(doc => doc.id === chunk.document_id);
        if (!document) return null;
        return {
          document,
          chunk,
          similarity: result.similarity_score,
          fts_score: result.fts_score
        } as KnowledgeSearchResult;
      })
      .filter(Boolean) as KnowledgeSearchResult[];

    if (options.subspecialty) {
      const subspecialty = options.subspecialty.toLowerCase();
      results = results.filter(result =>
        (result.document.subspecialty || '').toLowerCase() === subspecialty
      );
    }

    if (options.diagnosisTag) {
      const needle = options.diagnosisTag.toLowerCase();
      results = results.filter(result =>
        result.document.diagnosis_tags.some(tag => tag.toLowerCase() === needle)
      );
    }

    return results;
  }

  private async semanticSearch(
    query: string,
    limit: number,
    options: KnowledgeSearchOptions
  ): Promise<RetrievalResult[]> {
    const filters: Where[] = [
      { content_type: { $eq: 'knowledge_chunk' } }
    ];

    if (options.documentId) {
      filters.push({ document_id: { $eq: options.documentId } });
    }

    if (options.subspecialty) {
      filters.push({ subspecialty: { $eq: options.subspecialty } });
    }

    if (filters.length === 1) {
      return this.retrieval.search(query, limit, filters[0]);
    }

    return this.retrieval.search(query, limit, { $and: filters });
  }

  private async ftsSearch(
    query: string,
    limit: number,
    options: KnowledgeSearchOptions
  ): Promise<RetrievalResult[]> {
    const normalized = query.replace(/[_]+/g, ' ');
    const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
    const uniqueTokens = Array.from(new Set(tokens.map(term => term.trim()).filter(Boolean)));
    const ftsQuery = uniqueTokens.map(term => term.replace(/"/g, '""')).join(' OR ');

    if (!ftsQuery) return [];

    let sql = `
      SELECT f.chunk_id, f.document_id, f.content, bm25(knowledge_chunks_fts) as bm25_score
      FROM knowledge_chunks_fts f
      WHERE f.content MATCH ?
    `;

    const params: Array<string | number> = [ftsQuery];

    if (options.documentId) {
      sql += ' AND f.document_id = ?';
      params.push(options.documentId);
    }

    sql += ` ORDER BY bm25_score ASC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as Array<{
      chunk_id: string;
      document_id: string;
      content: string;
      bm25_score: number;
    }>;

    return rows.map(row => {
      const normalizedScore = row.bm25_score <= 0 ? 1 : 1 / (1 + row.bm25_score);
      return {
        message: {
          id: row.chunk_id,
          conversation_id: row.document_id,
          role: 'system',
          content: row.content,
          created_at: new Date().toISOString()
        },
        similarity_score: normalizedScore,
        conversation_summary: row.document_id,
        content_type: 'knowledge_chunk',
        fts_score: row.bm25_score
      };
    });
  }

  private getChunksByIds(chunkIds: string[]): KnowledgeChunk[] {
    if (chunkIds.length === 0) return [];
    const placeholders = chunkIds.map(() => '?').join(', ');
    const rows = this.db.prepare(
      `SELECT * FROM knowledge_chunks WHERE id IN (${placeholders})`
    ).all(...chunkIds) as DbKnowledgeChunkRow[];
    return rows.map(row => this.mapChunk(row));
  }

  private getDocumentsByIds(documentIds: string[]): KnowledgeDocument[] {
    if (documentIds.length === 0) return [];
    const placeholders = documentIds.map(() => '?').join(', ');
    const rows = this.db.prepare(
      `SELECT * FROM knowledge_documents WHERE id IN (${placeholders})`
    ).all(...documentIds) as DbKnowledgeDocumentRow[];
    return rows.map(row => this.mapDocument(row));
  }

  private mapDocument(row: DbKnowledgeDocumentRow): KnowledgeDocument {
    return {
      id: row.id,
      title: row.title,
      source: row.source,
      version: row.version,
      subspecialty: row.subspecialty,
      diagnosis_tags: parseJson<string[]>(row.diagnosis_tags) || [],
      content_type: row.content_type || 'text',
      published_at: row.published_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapChunk(row: DbKnowledgeChunkRow): KnowledgeChunk {
    return {
      id: row.id,
      document_id: row.document_id,
      chunk_index: row.chunk_index,
      content: row.content,
      created_at: row.created_at
    };
  }
}

let sharedKnowledgeManager: KnowledgeManager | null = null;

export function getKnowledgeManager(): KnowledgeManager {
  if (!sharedKnowledgeManager) {
    sharedKnowledgeManager = new KnowledgeManager();
  }
  return sharedKnowledgeManager;
}
