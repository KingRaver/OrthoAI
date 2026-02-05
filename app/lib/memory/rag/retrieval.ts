// app/lib/memory/rag/retrieval.ts
// Chroma vector database integration for semantic search

import { ChromaClient } from 'chromadb';
import { RetrievalResult, Message } from '../schemas';
import { LocalEmbeddings } from './embeddings';
import { getStorage } from '../storage';

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
    // Initialize Chroma client with host/port (HTTP connection)
    const chromaHost = process.env.CHROMA_HOST || 'localhost';
    const chromaPort = parseInt(process.env.CHROMA_PORT || '8000', 10);

    this.client = new ChromaClient({
      host: chromaHost,
      port: chromaPort,
    });

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
        console.log('[ChromaRetrieval] Stored collection metadata:', storedMeta || 'none');
        console.log('[ChromaRetrieval] Current collection metadata:', currentMeta);
        console.log('[ChromaRetrieval] Collection metadata mismatch or missing; rebuilding collection...');
        try {
          await this.client.deleteCollection({ name: this.collectionName });
        } catch {
          // Collection might not exist, continue
        }
      } else {
        console.log('[ChromaRetrieval] Stored collection metadata:', storedMeta);
        console.log('[ChromaRetrieval] Current collection metadata:', currentMeta);
        // If metadata matches, keep the existing collection if it exists
        try {
          await this.client.getCollection({ name: this.collectionName });
          console.log('[ChromaRetrieval] Existing collection found, keeping it.');
          return;
        } catch {
          console.log('[ChromaRetrieval] Existing collection not found, creating new...');
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
      console.log(`[ChromaRetrieval] Collection '${this.collectionName}' ready`);
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

      console.log(`[ChromaRetrieval] Added message ${message.id} to Chroma`);
    } catch (error) {
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

      console.log(`[ChromaRetrieval] Added ${messages.length} messages to Chroma`);
    } catch (error) {
      console.error('[ChromaRetrieval] Error adding batch embeddings:', error);
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
    filters?: Record<string, any>
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
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: filters, // Optional metadata filtering
        include: ['embeddings', 'distances', 'documents', 'metadatas'],
      });

      const responseTime = Date.now() - startTime;

      // Log search for analytics
      const storage = getStorage();
      const topScore = (results.distances?.[0]?.[0] || 0);
      storage.logSearchQuery(
        query,
        results.ids?.[0]?.length || 0,
        topScore,
        responseTime
      );

      // Transform results
      if (!results.ids?.[0] || results.ids[0].length === 0) {
        console.log('[ChromaRetrieval] No results found for query');
        return [];
      }

      const retrievalResults: RetrievalResult[] = [];

      for (let i = 0; i < results.ids[0].length; i++) {
        const messageId = results.ids[0][i];
        const distance = results.distances?.[0]?.[i] || 0;
        const document = results.documents?.[0]?.[i] || '';
        const metadata = results.metadatas?.[0]?.[i] as any || {};
        const contentType = metadata.content_type || 'message';

        // Chroma uses distance (lower is better), convert to similarity (0-1)
        // For cosine: similarity = 1 - distance
        const similarity = Math.max(0, 1 - distance);

        // Filter by threshold
        if (similarity < this.similarityThreshold) {
          continue;
        }

        if (contentType !== 'message') {
          const syntheticMessage: Message = {
            id: messageId,
            conversation_id: metadata.conversation_id || 'profile',
            role: 'system',
            content: document,
            created_at: metadata.created_at || new Date().toISOString(),
          };

          retrievalResults.push({
            message: syntheticMessage,
            similarity_score: similarity,
            conversation_summary: metadata.conversation_id,
            content_type: contentType,
          });
          continue;
        }

        // Fetch full message from database
        const storage = getStorage();
        const fullMessage = storage.getMessage(messageId);

        if (fullMessage) {
          retrievalResults.push({
            message: fullMessage,
            similarity_score: similarity,
            conversation_summary: metadata.conversation_id,
            content_type: 'message',
          });
        }
      }

      console.log(
        `[ChromaRetrieval] Found ${retrievalResults.length} results (${responseTime}ms)`
      );

      return retrievalResults;
    } catch (error) {
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
      content_type?: 'message' | 'conversation_summary' | 'user_profile';
    },
    topK?: number
  ): Promise<RetrievalResult[]> {
    const conditions: Record<string, any>[] = [];

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
    let chromaFilters: Record<string, any> | undefined = undefined;
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
    metadata: Record<string, any>
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
      console.log(`[ChromaRetrieval] Deleted message ${messageId}`);
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
        console.log(
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
      console.log(`[ChromaRetrieval] Collection cleared and reinitialized`);
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

      // Build FTS query - escape special characters
      const ftsQuery = query
        .replace(/[^\w\s]/g, ' ')  // Remove special chars
        .trim()
        .split(/\s+/)               // Split on whitespace
        .filter(term => term.length > 2)  // Filter short terms
        .join(' OR ');              // Join with OR for broader matching

      if (!ftsQuery) {
        console.log('[ChromaRetrieval] FTS query too short, returning empty results');
        return [];
      }

      // Build SQL query
      let sql = `
        SELECT
          f.message_id,
          f.conversation_id,
          f.content,
          f.role,
          bm25(f) as bm25_score
        FROM messages_fts f
        WHERE f.content MATCH ?
      `;

      const params: any[] = [ftsQuery];

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

      // Transform to RetrievalResult format
      const results: RetrievalResult[] = [];

      for (const row of rows) {
        // Fetch full message from database
        const fullMessage = storage.getMessage(row.message_id);

        if (fullMessage) {
          // Normalize BM25 score to 0-1 range (FTS5 bm25: lower is better)
          const normalizedScore = row.bm25_score <= 0
            ? 1
            : 1 / (1 + row.bm25_score);

          results.push({
            message: fullMessage,
            similarity_score: normalizedScore,
            conversation_summary: row.conversation_id,
            content_type: 'message',
            fts_score: row.bm25_score,  // Keep raw score for debugging
          });
        }
      }

      console.log(
        `[ChromaRetrieval] FTS search found ${results.length} results for query: "${ftsQuery}"`
      );

      return results;
    } catch (error) {
      console.error('[ChromaRetrieval] FTS search error:', error);
      // Graceful fallback - return empty results if FTS unavailable
      return [];
    }
  }
}
