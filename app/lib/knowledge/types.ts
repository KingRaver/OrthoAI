export interface KnowledgeDocument {
  id: string;
  title: string;
  source: string | null;
  version: string | null;
  subspecialty: string | null;
  diagnosis_tags: string[];
  content_type: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  created_at: string;
}

export interface KnowledgeSearchResult {
  document: KnowledgeDocument;
  chunk: KnowledgeChunk;
  similarity: number;
  fts_score?: number;
}
