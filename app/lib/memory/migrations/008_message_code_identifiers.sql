-- Phase 2: Store precomputed code identifiers for reranking
ALTER TABLE messages ADD COLUMN code_identifiers TEXT;
