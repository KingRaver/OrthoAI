export type KnowledgeSourceCategory = 'guideline' | 'evidence' | 'reference';

export type KnowledgeSourceType =
  | 'aaos'
  | 'ao'
  | 'acsm'
  | 'pt'
  | 'atlas'
  | 'pubmed'
  | 'cochrane'
  | 'local';

export type KnowledgeSyncJobType = 'guideline_seed' | 'evidence_sync' | 'cleanup';

export type KnowledgeSyncJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type EvidenceLevel = 'level-1' | 'level-2' | 'level-3' | 'level-4' | 'level-5';

export type ClinicalReferenceCategory =
  | 'implant'
  | 'medication_protocol'
  | 'injection_technique'
  | 'dme_bracing';

export interface KnowledgeSource {
  id: string;
  source_key: string;
  name: string;
  authority: string | null;
  category: KnowledgeSourceCategory;
  source_type: KnowledgeSourceType;
  endpoint: string | null;
  enabled: boolean;
  sync_cursor: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSyncJob {
  id: string;
  job_type: KnowledgeSyncJobType;
  source_key: string | null;
  status: KnowledgeSyncJobStatus;
  payload: Record<string, unknown> | null;
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
}

export interface EvidenceRecord {
  id: string;
  source_key: string;
  external_id: string;
  title: string;
  abstract_text: string | null;
  url: string | null;
  journal: string | null;
  authors: string[];
  publication_date: string | null;
  publication_types: string[];
  study_type: string | null;
  evidence_level: EvidenceLevel | null;
  evidence_score: number;
  keywords: string[];
  raw_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalReferenceItem {
  id: string;
  category: ClinicalReferenceCategory;
  name: string;
  summary: string;
  indications: string | null;
  contraindications: string | null;
  metadata_json: Record<string, unknown> | null;
  source: string | null;
  version: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStoragePolicy {
  id: string;
  max_chunk_characters: number;
  max_evidence_records: number;
  retention_days: number;
  updated_at: string;
}

export interface EvidenceSearchOptions {
  limit?: number;
  sourceKey?: string;
  includeRemote?: boolean;
  minEvidenceLevel?: EvidenceLevel;
}

export interface PubMedSearchOptions {
  maxResults?: number;
  sinceDate?: string | null;
  apiKey?: string;
}

export interface ExternalEvidenceRecord {
  externalId: string;
  title: string;
  abstractText: string;
  journal: string | null;
  publicationDate: string | null;
  publicationTypes: string[];
  authors: string[];
  keywords: string[];
  url: string | null;
  rawPayload?: Record<string, unknown>;
}

export interface GuidelineTemplate {
  guidelineKey: string;
  title: string;
  source: string;
  version: string;
  subspecialty: string;
  diagnosisTags: string[];
  publishedAt?: string;
  content: string;
}

export interface SyncJobResult {
  job: KnowledgeSyncJob;
  processed: boolean;
  message: string;
}
