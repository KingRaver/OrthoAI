// app/lib/memory/schemas.ts
// Complete TypeScript definitions for the memory system

/**
 * Message types - represents individual messages in a conversation
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tokens_used?: number;
  tool_calls?: ToolCall[];
  tool_results?: ToolResult[];
  model_used?: string;
  temperature?: number;
}

/**
 * Conversation types - represents a full chat session
 */
export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model_used?: string;
  total_tokens: number;
  summary?: string;
  tags?: string[];
}

/**
 * Conversation summary record
 */
export interface ConversationSummary {
  conversation_id: string;
  summary: string;
  updated_at: string;
  content_hash?: string;
  embedding_status: 'pending' | 'success' | 'failed';
  error_message?: string;
}

/**
 * Single-user profile record (local only)
 */
export interface UserProfile {
  id: string;
  profile: string;
  updated_at: string;
  content_hash?: string;
  embedding_status: 'pending' | 'success' | 'failed';
  error_message?: string;
}

/**
 * Tool execution metadata
 */
export interface ToolCall {
  id: string;
  function_name: string;
  arguments: Record<string, unknown>;
  created_at?: string;
}

export interface ToolResult {
  tool_call_id: string;
  function_name: string;
  result: unknown;
  error?: string;
  created_at?: string;
}

/**
 * User preferences - key-value pairs with typed values
 */
export interface UserPreference {
  key: string;
  value: string;
  data_type: 'string' | 'json' | 'number' | 'boolean';
  created_at: string;
  updated_at: string;
}

/**
 * Embedding metadata - tracks which messages are embedded in Chroma
 */
export interface EmbeddingMetadata {
  id: string;
  message_id: string;
  conversation_id: string;
  chroma_id?: string;
  created_at: string;
  embedding_status: 'pending' | 'success' | 'failed';
  error_message?: string;
}

/**
 * Session metadata - for multi-user expansion potential
 */
export interface Session {
  id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  context_tokens_used: number;
}

/**
 * Search result from RAG retrieval
 */
export interface RetrievalResult {
  message: Message;
  similarity_score: number;
  conversation_summary?: string;
  content_type?: 'message' | 'conversation_summary' | 'user_profile';
  fts_score?: number;  // Phase 3: BM25 score from FTS search
}

/**
 * Embedding payload - OpenAI-compatible embeddings request
 */
export interface EmbeddingRequest {
  model: string;
  input: string | string[];  // Single string or array of strings for batch
}

export interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
  model?: string;
}

/**
 * Chroma collection query result
 */
export interface ChromaQueryResult {
  ids: string[][];
  distances: number[][];
  metadatas: Record<string, unknown>[][];
  documents: string[][];
  embeddings?: number[][][];
}

/**
 * Memory manager configuration
 */
export interface MemoryConfig {
  sqlite_db_path: string;
  chroma_host?: string;
  chroma_port?: number;
  chroma_collection_name: string;
  embedding_model: string;
  embedding_host: string;
  rag_top_k: number;
  similarity_threshold: number;
}

/**
 * Augmented prompt with retrieved context
 */
export interface AugmentedPrompt {
  original_query: string;
  retrieved_context: RetrievalResult[];
  enhanced_system_prompt: string;
}

/**
 * Memory system health check
 */
export interface MemoryHealthStatus {
  sqlite_connected: boolean;
  chroma_connected: boolean;
  embedding_model_available: boolean;
  total_conversations: number;
  total_messages: number;
  pending_embeddings: number;
  last_check: string;
  errors?: string[];
}
