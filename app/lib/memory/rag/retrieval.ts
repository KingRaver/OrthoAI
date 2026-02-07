// app/lib/memory/rag/retrieval.ts
// Chroma vector database integration for semantic search

import { ChromaClient, type Metadata, type Where } from 'chromadb';
import { RetrievalResult, Message, MessageChunk } from '../schemas';
import { LocalEmbeddings } from './embeddings';
import { getStorage } from '../storage';
import { getMemoryConfig } from '../config';
import { memoryDebug } from '../debug';
import { recordMemoryFailure, recordMemorySuccess } from '../ops';

let sharedChromaClient: ChromaClient | null = null;

function getChromaClient(): ChromaClient {
  if (!sharedChromaClient) {
    const chromaHost = process.env.CHROMA_HOST || 'localhost';
    const chromaPort = parseInt(process.env.CHROMA_PORT || '8000', 10);
    sharedChromaClient = new ChromaClient({ host: chromaHost, port: chromaPort });
  }
  return sharedChromaClient;
}

type RagContentType = NonNullable<RetrievalResult['content_type']>;

type RagMetadata = Metadata & {
  conversation_id?: string | null;
  role?: Message['role'];
  created_at?: string | null;
  model_used?: string | null;
  message_length?: number | null;
  content_type?: RagContentType | null;
  parent_message_id?: string | null;
  chunk_index?: number | null;
  chunk_kind?: 'code' | 'prose' | null;
  chunk_language?: string | null;
  token_estimate?: number | null;
};

/**
 * Chroma Retrieval Engine
 * Manages vector storage and semantic search
 */
export class ChromaRetrieval {
  private client: ChromaClient;
  private collectionName: string;
  private embeddings: LocalEmbeddings;
  private topK: number;
  private similarityThreshold: number;

  constructor(
    embeddingModel: LocalEmbeddings,
    collectionName: string = 'orthoai_conversations',
    topK: number = 5,
    similarityThreshold: number = 0.3
  ) {
    this.client = getChromaClient();

    this.collectionName = collectionName;
    this.embeddings = embeddingModel;
    this.topK = topK;
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Initialize Chroma collection
   * Recreates collection if it exists with incompatible embedding function
   */
  async initialize(): Promise<void> {
    try {
      const storage = getStorage();
      const storedPreference = storage.getPreference('rag_collection_meta');
      const storedMeta = storedPreference?.data_type === 'json'
        ? JSON.parse(storedPreference.value)
        : null;

      const embeddingModel = this.embeddings.getEmbeddingModel();
      const embeddingDimension = await this.embeddings.getEmbeddingDimension();
      const currentMeta = {
        collection_name: this.collectionName,
        embedding_model: embeddingModel,
        embedding_dimension: embeddingDimension,
      };

      const needsRebuild = !storedMeta ||
        storedMeta.collection_name !== currentMeta.collection_name ||
        storedMeta.embedding_model !== currentMeta.embedding_model ||
        storedMeta.embedding_dimension !== currentMeta.embedding_dimension;

      if (needsRebuild) {
        memoryDebug('[ChromaRetrieval] Stored collection metadata:', storedMeta || 'none');
        memoryDebug('[ChromaRetrieval] Current collection metadata:', currentMeta);
        memoryDebug('[ChromaRetrieval] Collection metadata mismatch or missing; rebuilding collection...');
        try {
          await this.client.deleteCollection({ name: this.collectionName });
        } catch {
          // Collection might not exist, continue
        }
      } else {
        memoryDebug('[ChromaRetrieval] Stored collection metadata:', storedMeta);
        memoryDebug('[ChromaRetrieval] Current collection metadata:', currentMeta);
        // If metadata matches, keep the existing collection if it exists
        try {
          await this.client.getCollection({ name: this.collectionName });
          memoryDebug('[ChromaRetrieval] Existing collection found, keeping it.');
          return;
        } catch {
          memoryDebug('[ChromaRetrieval] Existing collection not found, creating new...');
        }
      }

      // Create collection with no embedding function (we provide embeddings directly)
      await this.client.createCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
        metadata: {
          hnsw_space: 'cosine', // Use cosine similarity
          description: 'OrthoAI conversation embeddings',
          created_at: new Date().toISOString(),
          embedding_provider: 'local',
        },
      });

      storage.setPreference('rag_collection_meta', currentMeta);
      memoryDebug(`[ChromaRetrieval] Collection '${this.collectionName}' ready`);
    } catch (error) {
      console.error('[ChromaRetrieval] Error initializing collection:', error);
      throw error;
    }
  }

  /**
   * Add message embedding to Chroma
   * Stores both user and assistant messages
   */
  async addMessageEmbedding(message: Message): Promise<void> {
    try {
      // Generate embedding for the message content
      const embedding = await this.embeddings.embed(message.content);

      // Get collection
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      // Add to collection with metadata
      await collection.add({
        ids: [message.id],
        embeddings: [embedding],
        documents: [message.content],
        metadatas: [
          {
            conversation_id: message.conversation_id,
            role: message.role,
            created_at: message.created_at,
            model_used: message.model_used || 'unknown',
            message_length: message.content.length,
            content_type: 'message',
          },
        ],
      });

      recordMemorySuccess('embedding');
      memoryDebug(`[ChromaRetrieval] Added message ${message.id} to Chroma`);
    } catch (error) {
      recordMemoryFailure('embedding', 'ChromaRetrieval.addMessageEmbedding', error);
      console.error('[ChromaRetrieval] Error adding message embedding:', error);
      throw error;
    }
  }

  /**
   * Add multiple message embeddings in batch
   * More efficient than adding one at a time
   */
  async addMessageEmbeddingsBatch(messages: Message[]): Promise<void> {
    try {
      if (messages.length === 0) return;

      // Generate embeddings for all messages
      const contents = messages.map(m => m.content);
      const embeddings = await this.embeddings.embedBatch(contents);

      // Prepare data for Chroma
      const ids = messages.map(m => m.id);
      const documents = messages.map(m => m.content);
      const metadatas = messages.map(m => ({
        conversation_id: m.conversation_id,
        role: m.role,
        created_at: m.created_at,
        model_used: m.model_used || 'unknown',
        message_length: m.content.length,
        content_type: 'message',
      }));

      // Get collection
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      // Add to collection
      await collection.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });

      recordMemorySuccess('embedding');
      memoryDebug(`[ChromaRetrieval] Added ${messages.length} messages to Chroma`);
    } catch (error) {
      recordMemoryFailure('embedding', 'ChromaRetrieval.addMessageEmbeddingsBatch', error);
      console.error('[ChromaRetrieval] Error adding batch embeddings:', error);
      throw error;
    }
  }

  /**
   * Add chunk embeddings for a message
   */
  async addMessageChunkEmbeddings(
    chunks: MessageChunk[],
    parentRole: Message['role'] = 'assistant'
  ): Promise<void> {
    try {
      if (chunks.length === 0) return;

      const contents = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddings.embedBatch(contents);
      const ids = chunks.map(chunk => chunk.id);
      const metadatas = chunks.map(chunk => ({
        conversation_id: chunk.conversation_id,
        role: parentRole,
        created_at: chunk.created_at,
        message_length: chunk.content.length,
        content_type: 'message_chunk' as const,
        parent_message_id: chunk.parent_message_id,
        chunk_index: chunk.chunk_index,
        chunk_kind: chunk.chunk_kind,
        chunk_language: chunk.language ?? null,
        token_estimate: chunk.token_estimate,
      }));

      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      try {
        await collection.delete({ ids });
      } catch {
        // Ignore missing IDs during refresh
      }

      await collection.add({
        ids,
        embeddings,
        documents: contents,
        metadatas,
      });
    } catch (error) {
      recordMemoryFailure('embedding', 'ChromaRetrieval.addMessageChunkEmbeddings', error);
      console.error('[ChromaRetrieval] Error adding chunk embeddings:', error);
      throw error;
    }
  }

  /**
   * Search for semantically similar messages
   * Returns top-k messages with similarity scores
   */
  async search(
    query: string,
    topK?: number,
    filters?: Where
  ): Promise<RetrievalResult[]> {
    try {
      const k = topK || this.topK;
      const startTime = Date.now();

      // Generate query embedding
      const queryEmbedding = await this.embeddings.embed(query);

      // Get collection
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      // Query collection
      const results = await collection.query<RagMetadata>({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: filters, // Optional metadata filtering
        include: ['distances', 'documents', 'metadatas'],
      });

      const responseTime = Date.now() - startTime;

      // Log search for analytics
      const storage = getStorage();
      const topScore = (results.distances?.[0]?.[0] || 0);
      const config = getMemoryConfig();
      if (
        config.searchQueryLoggingEnabled &&
        Math.random() <= config.searchQueryLoggingSampleRate
      ) {
        storage.logSearchQuery(
          query,
          results.ids?.[0]?.length || 0,
          topScore,
          responseTime
        );
      }
      const filterScope = filters ? JSON.stringify(filters) : 'global';

      // Transform results
      if (!results.ids?.[0] || results.ids[0].length === 0) {
        memoryDebug(
          `[ChromaRetrieval] No semantic results (collection: ${this.collectionName}, filters: ${filterScope})`
        );
        return [];
      }

      const retrievalResults: RetrievalResult[] = [];
      const entries = results.ids[0].map((messageId, idx) => {
        const metadata: RagMetadata = results.metadatas?.[0]?.[idx] ?? {};
        return {
          messageId,
          distance: results.distances?.[0]?.[idx] ?? 0,
          document: results.documents?.[0]?.[idx] ?? '',
          metadata,
        };
      });

      const messageIds = entries
        .filter(entry => (entry.metadata.content_type ?? 'message') === 'message')
        .map(entry => entry.messageId);
      const messagesById = new Map(
        storage.getMessagesByIds(messageIds).map(msg => [msg.id, msg])
      );

      for (const entry of entries) {
        const contentType: RagContentType = entry.metadata.content_type ?? 'message';
        const similarity = Math.max(0, 1 - entry.distance);

        if (similarity < this.similarityThreshold) {
          continue;
        }

        const conversationId =
          typeof entry.metadata.conversation_id === 'string'
            ? entry.metadata.conversation_id
            : undefined;
        const createdAt =
          typeof entry.metadata.created_at === 'string'
            ? entry.metadata.created_at
            : undefined;

        if (contentType !== 'message') {
          const chunkKind =
            entry.metadata.chunk_kind === 'code' || entry.metadata.chunk_kind === 'prose'
              ? entry.metadata.chunk_kind
              : undefined;
          const chunkIndex =
            typeof entry.metadata.chunk_index === 'number'
              ? entry.metadata.chunk_index
              : undefined;
          const tokenEstimate =
            typeof entry.metadata.token_estimate === 'number'
              ? entry.metadata.token_estimate
              : undefined;
          const parentMessageId =
            typeof entry.metadata.parent_message_id === 'string'
              ? entry.metadata.parent_message_id
              : undefined;
          const chunkLanguage =
            typeof entry.metadata.chunk_language === 'string'
              ? entry.metadata.chunk_language
              : undefined;
          const role =
            entry.metadata.role === 'assistant' || entry.metadata.role === 'user'
              ? entry.metadata.role
              : 'system';

          const syntheticMessage: Message = {
            id: entry.messageId,
            conversation_id: conversationId ?? 'profile',
            role,
            content: entry.document,
            created_at: createdAt ?? new Date().toISOString(),
          };

          retrievalResults.push({
            message: syntheticMessage,
            similarity_score: similarity,
            conversation_summary: conversationId,
            content_type: contentType,
            parent_message_id: parentMessageId,
            chunk_index: chunkIndex,
            chunk_kind: chunkKind,
            chunk_language: chunkLanguage,
            token_estimate: tokenEstimate,
          });
          continue;
        }

        const fullMessage = messagesById.get(entry.messageId);
        if (fullMessage) {
          retrievalResults.push({
            message: fullMessage,
            similarity_score: similarity,
            conversation_summary: conversationId,
            content_type: 'message',
          });
        }
      }

      memoryDebug(
        `[ChromaRetrieval] Found ${retrievalResults.length} semantic results (${responseTime}ms, collection: ${this.collectionName}, filters: ${filterScope})`
      );

      return retrievalResults;
    } catch (error) {
      recordMemoryFailure('retrieval', 'ChromaRetrieval.search', error);
      console.error('[ChromaRetrieval] Error searching:', error);
      throw error;
    }
  }

  /**
   * Search with metadata filters
   * Example: Find only messages from a specific conversation or role
   */
  async searchWithFilters(
    query: string,
    filters: {
      conversation_id?: string;
      role?: 'user' | 'assistant';
      dateRange?: { from: Date; to: Date };
      content_type?: 'message' | 'message_chunk' | 'conversation_summary' | 'user_profile' | 'knowledge_chunk';
    },
    topK?: number
  ): Promise<RetrievalResult[]> {
    const conditions: Where[] = [];

    if (filters.conversation_id) {
      conditions.push({ conversation_id: { $eq: filters.conversation_id } });
    }

    if (filters.role) {
      conditions.push({ role: { $eq: filters.role } });
    }

    if (filters.content_type) {
      conditions.push({ content_type: { $eq: filters.content_type } });
    }

    // Build ChromaDB-compatible where clause
    let chromaFilters: Where | undefined = undefined;
    if (conditions.length === 1) {
      // Single condition: use it directly
      chromaFilters = conditions[0];
    } else if (conditions.length > 1) {
      // Multiple conditions: wrap in $and
      chromaFilters = { $and: conditions };
    }

    // Note: Chroma doesn't have direct date range support in filters
    // We'll filter on the client side after retrieval

    return this.search(query, topK, chromaFilters);
  }

  /**
   * Upsert a custom document embedding (summaries/profile)
   */
  async upsertDocumentEmbedding(
    id: string,
    content: string,
    metadata: RagMetadata
  ): Promise<void> {
    try {
      const embedding = await this.embeddings.embed(content);

      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      try {
        await collection.delete({ ids: [id] });
      } catch {
        // Ignore if it doesn't exist
      }

      await collection.add({
        ids: [id],
        embeddings: [embedding],
        documents: [content],
        metadatas: [metadata],
      });
    } catch (error) {
      console.error('[ChromaRetrieval] Error upserting document embedding:', error);
      throw error;
    }
  }

  /**
   * Delete a custom document embedding (summaries/profile)
   */
  async deleteDocumentEmbedding(id: string): Promise<void> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
        embeddingFunction: undefined,
      });

      await collection.delete({ ids: [id] });
    } catch (error) {
      console.error('[ChromaRetrieval] Error deleting document embedding:', error);
    }
  }

  /**
   * Delete message from Chroma
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });

      await collection.delete({ ids: [messageId] });
      memoryDebug(`[ChromaRetrieval] Deleted message ${messageId}`);
    } catch (error) {
      console.error('[ChromaRetrieval] Error deleting message:', error);
      throw error;
    }
  }

  /**
   * Delete all embeddings for a conversation
   */
  async deleteConversationEmbeddings(conversationId: string): Promise<void> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });

      // Query to find all messages in this conversation
      const results = await collection.get({
        where: { conversation_id: { $eq: conversationId } },
      });

      if (results.ids && results.ids.length > 0) {
        await collection.delete({ ids: results.ids });
        memoryDebug(
          `[ChromaRetrieval] Deleted ${results.ids.length} embeddings for conversation ${conversationId}`
        );
      }
    } catch (error) {
      console.error('[ChromaRetrieval] Error deleting conversation embeddings:', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    count: number;
    name: string;
  }> {
    try {
      const collection = await this.client.getCollection({
        name: this.collectionName,
      });

      const count = await collection.count();

      return {
        count,
        name: this.collectionName,
      };
    } catch (error) {
      console.error('[ChromaRetrieval] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Clear entire collection
   */
  async clear(): Promise<void> {
    try {
      await this.client.deleteCollection({ name: this.collectionName });
      await this.initialize();
      memoryDebug(`[ChromaRetrieval] Collection cleared and reinitialized`);
    } catch (error) {
      console.error('[ChromaRetrieval] Error clearing collection:', error);
      throw error;
    }
  }

  /**
   * FTS (Full-Text Search) lexical search
   * Phase 3: Hybrid Retrieval
   * Uses SQLite FTS5 for keyword/code identifier matching
   */
  async ftsSearch(
    query: string,
    conversationId?: string,
    limit: number = 10
  ): Promise<RetrievalResult[]> {
    try {
      const storage = getStorage();
      const db = storage.getDatabase();
      const config = getMemoryConfig();

      // Build FTS query - escape special characters
      const normalized = query.replace(/[_]+/g, ' ');
      const tokens = normalized.match(/[A-Za-z0-9]{2,}/g) || [];
      const uniqueTokens = Array.from(
        new Set(tokens.map(term => term.trim()).filter(Boolean))
      );
      const ftsQuery = uniqueTokens
        .map(term => term.replace(/"/g, '""'))
        .join(' OR ');

      if (!ftsQuery) {
        memoryDebug('[ChromaRetrieval] FTS query too short, returning empty results');
        return [];
      }

      // Build SQL query
      let sql = `
        SELECT
          f.message_id,
          f.conversation_id,
          f.content,
          f.role,
          bm25(messages_fts) as bm25_score
        FROM messages_fts f
        WHERE f.content MATCH ?
      `;

      const params: Array<string | number> = [ftsQuery];

      // Filter by conversation if provided
      if (conversationId) {
        sql += ` AND f.conversation_id = ?`;
        params.push(conversationId);
      }

      sql += `
        ORDER BY bm25_score ASC
        LIMIT ?
      `;
      params.push(limit);

      const stmt = db.prepare(sql);
      const rows = stmt.all(...params) as Array<{
        message_id: string;
        conversation_id: string;
        content: string;
        role: string;
        bm25_score: number;
      }>;

      // Transform message results to RetrievalResult format
      const messageResults: RetrievalResult[] = [];
      const messageIds = rows.map(row => row.message_id);
      const messagesById = new Map(
        storage.getMessagesByIds(messageIds).map(msg => [msg.id, msg])
      );

      for (const row of rows) {
        const fullMessage = messagesById.get(row.message_id);
        if (!fullMessage) continue;

        const normalizedScore = row.bm25_score <= 0
          ? 1
          : 1 / (1 + row.bm25_score);

        messageResults.push({
          message: fullMessage,
          similarity_score: normalizedScore,
          conversation_summary: row.conversation_id,
          content_type: 'message',
          fts_score: row.bm25_score,  // Keep raw score for debugging
        });
      }

      const chunkResults: RetrievalResult[] = [];
      if (config.ragChunking) {
        try {
          let chunkSql = `
            SELECT
              c.id AS chunk_id,
              c.parent_message_id,
              c.conversation_id,
              c.chunk_index,
              c.chunk_kind,
              c.language,
              c.token_estimate,
              c.content,
              c.created_at,
              m.role,
              bm25(chunks_fts) AS bm25_score
            FROM chunks_fts
            INNER JOIN message_chunks c ON c.id = chunks_fts.chunk_id
            INNER JOIN messages m ON m.id = c.parent_message_id
            WHERE chunks_fts.content MATCH ?
          `;
          const chunkParams: Array<string | number> = [ftsQuery];
          if (conversationId) {
            chunkSql += ` AND c.conversation_id = ?`;
            chunkParams.push(conversationId);
          }
          chunkSql += `
            ORDER BY bm25_score ASC
            LIMIT ?
          `;
          chunkParams.push(limit);

          const chunkRows = db.prepare(chunkSql).all(...chunkParams) as Array<{
            chunk_id: string;
            parent_message_id: string;
            conversation_id: string;
            chunk_index: number;
            chunk_kind: 'code' | 'prose';
            language: string | null;
            token_estimate: number;
            content: string;
            created_at: string;
            role: Message['role'];
            bm25_score: number;
          }>;

          for (const row of chunkRows) {
            const normalizedScore = row.bm25_score <= 0
              ? 1
              : 1 / (1 + row.bm25_score);
            chunkResults.push({
              message: {
                id: row.chunk_id,
                conversation_id: row.conversation_id,
                role: row.role,
                content: row.content,
                created_at: row.created_at,
              },
              similarity_score: normalizedScore,
              conversation_summary: row.conversation_id,
              content_type: 'message_chunk',
              parent_message_id: row.parent_message_id,
              chunk_index: row.chunk_index,
              chunk_kind: row.chunk_kind,
              chunk_language: row.language ?? undefined,
              token_estimate: row.token_estimate,
              fts_score: row.bm25_score,
            });
          }
        } catch (chunkError) {
          console.warn('[ChromaRetrieval] Chunk FTS search unavailable:', chunkError);
        }
      }

      const merged = [...messageResults, ...chunkResults]
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

      memoryDebug(
        `[ChromaRetrieval] FTS search found ${merged.length} results for query: "${ftsQuery}"` +
        ` (messages=${messageResults.length}, chunks=${chunkResults.length})`
      );

      return merged;
    } catch (error) {
      recordMemoryFailure('retrieval', 'ChromaRetrieval.ftsSearch', error);
      console.error('[ChromaRetrieval] FTS search error:', error);
      // Graceful fallback - return empty results if FTS unavailable
      return [];
    }
  }
}
