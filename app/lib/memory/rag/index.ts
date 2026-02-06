// app/lib/memory/rag/index.ts
// RAG (Retrieval-Augmented Generation) Orchestrator

import { LocalEmbeddings, getSharedEmbeddings } from './embeddings';
import { ChromaRetrieval } from './retrieval';
import { Message, AugmentedPrompt, RetrievalResult } from '../schemas';
import { getStorage } from '../storage';
import { logRetrievalMetrics, RetrievalMetrics } from '../metrics';
import { getMemoryConfig } from '../config';
import { deduplicateAndRerank } from './rerank';

type SqliteStats = ReturnType<ReturnType<typeof getStorage>['getStats']>;

/**
 * RAG Manager
 * Orchestrates embeddings, storage, and retrieval
 * This is the main interface for RAG operations
 */
export class RAGManager {
  private embeddings: LocalEmbeddings;
  private retrieval: ChromaRetrieval;
  private initialized: boolean = false;

  constructor(
    embeddingModel?: string,
    collectionName?: string,
    topK?: number,
    similarityThreshold?: number
  ) {
    // Use shared embeddings instance to share cache with DL-CodeGen
    this.embeddings = getSharedEmbeddings(embeddingModel);
    this.retrieval = new ChromaRetrieval(
      this.embeddings,
      collectionName,
      topK,
      similarityThreshold
    );
  }

  private estimateTokens(text: string): number {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    const wordCount = trimmed.split(/\s+/).length;
    const charCount = trimmed.length;
    return Math.max(wordCount, Math.ceil(charCount / 4));
  }

  private trimToTokenBudget(text: string, tokenBudget: number): string {
    if (tokenBudget <= 0) return '';
    const maxChars = tokenBudget * 4;
    if (text.length <= maxChars) return text;
    const safeLength = Math.max(0, maxChars - 3);
    return text.slice(0, safeLength).trimEnd() + '...';
  }

  /**
   * Initialize RAG system
   * Call once at app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('[RAGManager] Initializing RAG system...');

      // Check if embedding model is available
      const modelAvailable = await this.embeddings.checkModelAvailability();
      if (!modelAvailable) {
        console.warn(
          '[RAGManager] Embedding model not available. Ensure your embedding server is running and the model is loaded:'
        );
        console.warn('  Load your embedding model (e.g., nomic-embed-text)');
      }

      // Initialize Chroma collection
      await this.retrieval.initialize();

      this.initialized = true;
      console.log('[RAGManager] RAG system initialized successfully');
    } catch (error) {
      console.error('[RAGManager] Error initializing RAG system:', error);
      throw error;
    }
  }

  /**
   * Process and embed a new message
   * This happens after LLM generates a response
   */
  async processMessageForRAG(message: Message): Promise<void> {
    try {
      // Store in database first
      const storage = getStorage();
      const savedMessage = storage.getMessage(message.id) || message;

      // Add to Chroma for semantic search
      await this.retrieval.addMessageEmbedding(savedMessage);

      // Update embedding metadata
      storage.updateEmbeddingStatus(
        `emb_${message.id}`,
        'success',
        message.id
      );

      console.log(`[RAGManager] Message ${message.id} processed for RAG`);
    } catch (error) {
      console.error('[RAGManager] Error processing message for RAG:', error);

      // Still update status so we know it failed
      const storage = getStorage();
      storage.updateEmbeddingStatus(
        `emb_${message.id}`,
        'failed',
        undefined,
        (error as Error).message
      );
    }
  }

  /**
   * Batch process multiple messages
   * More efficient than processing one at a time
   */
  async processMessagesForRAG(messages: Message[]): Promise<void> {
    try {
      const storage = getStorage();

      // Add to Chroma in batch
      await this.retrieval.addMessageEmbeddingsBatch(messages);

      // Update embedding metadata for all
      messages.forEach(msg => {
        storage.updateEmbeddingStatus(
          `emb_${msg.id}`,
          'success',
          msg.id
        );
      });

      console.log(`[RAGManager] Processed ${messages.length} messages for RAG`);
    } catch (error) {
      console.error('[RAGManager] Error batch processing messages:', error);
      throw error;
    }
  }

  /**
   * Retrieve similar messages for a query
   * Used to augment LLM context
   */
  async retrieveSimilarMessages(
    query: string,
    topK?: number,
    conversationId?: string,
    includeProfile: boolean = false
  ): Promise<RetrievalResult[]> {
    const startTime = Date.now();
    const config = getMemoryConfig();

    // Track timing for each source
    let denseStartTime = 0;
    let denseMs = 0;
    let ftsMs = 0;
    let rerankStartTime = 0;
    let rerankMs = 0;

    try {
      console.log(
        `[RAGManager] Retrieving similar messages for: "${query.substring(0, 50)}..."`
      );

      let results: RetrievalResult[] = [];
      let conversationResults: RetrievalResult[] = [];
      let globalResults: RetrievalResult[] = [];
      let ftsResults: RetrievalResult[] = [];

      // Phase 3: Hybrid Retrieval (Dense + FTS)
      if (config.ragHybrid) {
        console.log('[RAGManager] Using hybrid retrieval (dense + FTS)');

        // Run dense and FTS searches in parallel
        denseStartTime = Date.now();
        const ftsStartTime = Date.now();

        const [denseConvResults, ftsConvResults] = await Promise.all([
          // Dense retrieval (semantic)
          conversationId
            ? this.retrieveWithFilters(
                query,
                { conversation_id: conversationId },
                topK ? topK * 2 : 10  // Over-fetch for reranking
              )
            : Promise.resolve([]),
          // FTS retrieval (lexical)
          this.retrieval.ftsSearch(query, conversationId, topK ? topK * 2 : 10),
        ]);

        denseMs = Date.now() - denseStartTime;
        ftsMs = Date.now() - ftsStartTime;

        conversationResults = denseConvResults;
        ftsResults = ftsConvResults;

        // Rerank combined results
        rerankStartTime = Date.now();
        results = deduplicateAndRerank(conversationResults, ftsResults, query);
        rerankMs = Date.now() - rerankStartTime;

        // Limit to topK after reranking
        if (topK) {
          results = results.slice(0, topK);
        }

        console.log(
          `[RAGManager] Hybrid retrieval: ${conversationResults.length} dense + ${ftsResults.length} FTS → ${results.length} reranked (dense: ${denseMs}ms, FTS: ${ftsMs}ms, rerank: ${rerankMs}ms)`
        );
      } else {
        // Phase 1-2: Dense-only retrieval (original behavior)
        denseStartTime = Date.now();
        if (conversationId) {
          conversationResults = await this.retrieveWithFilters(
            query,
            { conversation_id: conversationId },
            topK
          );
          results = conversationResults;
        }

        // Global fallback if conversation results are insufficient
        if (results.length === 0) {
          globalResults = await this.retrieval.search(query, topK);
          results = globalResults;
        }
        denseMs = Date.now() - denseStartTime;
      }

      // Summary retrieval
      let summaryResults: RetrievalResult[] = [];
      if (conversationId) {
        summaryResults = await this.retrieveWithFilters(
          query,
          { conversation_id: conversationId, content_type: 'conversation_summary' },
          1
        );
      }

      // Profile retrieval (only if consent given)
      let profileResults: RetrievalResult[] = [];
      if (includeProfile) {
        profileResults = await this.retrieveWithFilters(
          query,
          { content_type: 'user_profile' },
          1
        );
      }

      const merged = this.mergeResults(results, summaryResults, profileResults, topK);

      // Extract top similarities
      const topSimilarities = merged
        .slice(0, 3)
        .map(r => r.similarity_score);

      // Log retrieval metrics (Phase 1)
      const totalMs = Date.now() - startTime;
      const metrics: RetrievalMetrics = {
        query,
        timestamp: Date.now(),
        conversationId,
        sources: {
          conversationDense: conversationResults.length,
          globalDense: globalResults.length,
          summaries: summaryResults.length,
          profile: profileResults.length,
          ftsLexical: ftsResults.length,  // Phase 3: FTS result count
        },
        latency: {
          totalMs,
          denseMs,
          ftsMs,      // Phase 3: FTS search latency
          rerankMs,   // Phase 3: Reranking latency
        },
        topSimilarities,
        flags: {
          hybrid: config.ragHybrid,
          chunking: config.ragChunking,
          tokenBudget: config.ragTokenBudget,
        },
      };

      // Log metrics asynchronously (don't block retrieval)
      logRetrievalMetrics(metrics).catch(err => {
        console.warn('[RAGManager] Failed to log metrics:', err);
      });

      return merged;
    } catch (error) {
      console.error('[RAGManager] Error retrieving similar messages:', error);

      // Log failed retrieval
      const totalMs = Date.now() - startTime;
      logRetrievalMetrics({
        query,
        timestamp: Date.now(),
        conversationId,
        sources: {
          conversationDense: 0,
          globalDense: 0,
          summaries: 0,
          profile: 0,
          ftsLexical: 0,
        },
        latency: {
          totalMs,
          denseMs: 0,
        },
        topSimilarities: [],
        flags: {
          hybrid: config.ragHybrid,
          chunking: config.ragChunking,
          tokenBudget: config.ragTokenBudget,
        },
      }).catch(() => {}); // Ignore metric logging errors

      return [];
    }
  }

  /**
   * Retrieve messages with metadata filters
   */
  async retrieveWithFilters(
    query: string,
    filters: {
      conversation_id?: string;
      role?: 'user' | 'assistant';
      content_type?: 'message' | 'conversation_summary' | 'user_profile' | 'knowledge_chunk';
    },
    topK?: number
  ): Promise<RetrievalResult[]> {
    try {
      const results = await this.retrieval.searchWithFilters(
        query,
        filters,
        topK
      );

      return results;
    } catch (error) {
      console.error('[RAGManager] Error retrieving with filters:', error);
      return [];
    }
  }

  /**
   * Augment a user query with retrieved context
   * This is the main entry point for RAG-enhanced prompting
   */
  async augmentPrompt(
    userMessage: string,
    topK: number = 5,
    conversationId?: string,
    includeProfile: boolean = false
  ): Promise<AugmentedPrompt> {
    try {
      // Retrieve similar messages
      const retrievedContext = await this.retrieveSimilarMessages(
        userMessage,
        topK,
        conversationId,
        includeProfile
      );

      // Build context string with token budget enforcement
      let contextString = '';
      if (retrievedContext.length > 0) {
        const { ragTokenBudget } = getMemoryConfig();
        const header = 'Previous relevant context from your memory:\n\n';
        const footer = '---\n\n';
        let usedTokens = this.estimateTokens(header) + this.estimateTokens(footer);
        const entries: string[] = [];
        let memoryIndex = 1;

        for (const result of retrievedContext) {
          const label = `[Memory ${memoryIndex}] (Similarity: ${(
            result.similarity_score * 100
          ).toFixed(0)}%)`;
          const rolePrefix = `${result.message.role.toUpperCase()}: `;
          const snippet = result.message.content.substring(0, 200) +
            (result.message.content.length > 200 ? '...' : '');
          const entryPrefix = `${label}\n${rolePrefix}`;
          const entryText = `${entryPrefix}${snippet}`;
          const entryTokens = this.estimateTokens(entryText);

          if (usedTokens + entryTokens <= ragTokenBudget) {
            entries.push(entryText);
            usedTokens += entryTokens;
            memoryIndex += 1;
            continue;
          }

          const remainingTokens = ragTokenBudget - usedTokens - this.estimateTokens(entryPrefix);
          if (remainingTokens <= 0) {
            break;
          }

          const trimmedSnippet = this.trimToTokenBudget(snippet, remainingTokens);
          if (!trimmedSnippet) {
            break;
          }

          entries.push(`${entryPrefix}${trimmedSnippet}`);
          usedTokens += this.estimateTokens(`${entryPrefix}${trimmedSnippet}`);
          break;
        }

        if (entries.length > 0) {
          contextString = header + entries.join('\n\n') + footer;
        }
      }

      // Create enhanced system prompt
      const enhancedSystemPrompt = `You are OrthoAI - an orthopedic research assistant with memory of past conversations.

${contextString ? `You have access to relevant memories from past conversations that may help answer the current question.` : 'This is the start of a new conversation.'}

Continue to be rigorous, evidence-focused, and concise. Reference past conversations if relevant: "As we discussed before..." or "You mentioned..."`;

      return {
        original_query: userMessage,
        retrieved_context: retrievedContext,
        enhanced_system_prompt: enhancedSystemPrompt,
      };
    } catch (error) {
      console.error('[RAGManager] Error augmenting prompt:', error);

      // Return augmented prompt without context on error
      return {
        original_query: userMessage,
        retrieved_context: [],
        enhanced_system_prompt: `You are OrthoAI - an orthopedic research assistant.`,
      };
    }
  }

  /**
   * Get RAG system statistics
   */
  async getStats(): Promise<{
    chroma_stats: { count: number; name: string };
    sqlite_stats: SqliteStats;
    embedding_model_available: boolean;
    embedding_dimension: number | null;
  }> {
    try {
      const chromaStats = await this.retrieval.getStats();
      const storage = getStorage();
      const sqliteStats = storage.getStats();
      const modelAvailable = await this.embeddings.checkModelAvailability();

      let embeddingDim: number | null = null;
      if (modelAvailable) {
        try {
          embeddingDim = await this.embeddings.getEmbeddingDimension();
        } catch (error) {
          console.warn('[RAGManager] Could not get embedding dimension:', error);
        }
      }

      return {
        chroma_stats: chromaStats,
        sqlite_stats: sqliteStats,
        embedding_model_available: modelAvailable,
        embedding_dimension: embeddingDim,
      };
    } catch (error) {
      console.error('[RAGManager] Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Manual embedding of text (useful for debugging)
   */
  async embedText(text: string): Promise<number[]> {
    return this.embeddings.embed(text);
  }

  /**
   * Clear all RAG data (for testing/reset)
   */
  async clear(): Promise<void> {
    try {
      await this.retrieval.clear();
      this.embeddings.clearCache();
      console.log('[RAGManager] RAG system cleared');
    } catch (error) {
      console.error('[RAGManager] Error clearing RAG system:', error);
      throw error;
    }
  }

  /**
   * Format retrieved context for logging
   */
  formatContextForLogging(augmented: AugmentedPrompt): string {
    if (augmented.retrieved_context.length === 0) {
      return '(No similar context found)';
    }

    return augmented.retrieved_context
      .map(
        (r, i) =>
          `${i + 1}. [${r.message.role}] (${(r.similarity_score * 100).toFixed(0)}%) ${
            r.message.content.substring(0, 100) + '...'
          }`
      )
      .join('\n');
  }

  /**
   * Build a memory context block to append to system prompts
   */
  buildMemoryContextBlock(retrievedContext: RetrievalResult[]): string {
    if (retrievedContext.length === 0) {
      return '';
    }
    const { ragTokenBudget } = getMemoryConfig();
    const header = '\n\n[Memory Context]\n' +
      'You have access to relevant memories from past conversations that may help answer the current question.\n\n';
    const footer = '\n\nUse these memories only if they are directly relevant.';
    let usedTokens = this.estimateTokens(header) + this.estimateTokens(footer);

    let memoryIndex = 1;
    const entries: string[] = [];

    for (const result of retrievedContext) {
      const snippet = result.message.content.substring(0, 200) +
        (result.message.content.length > 200 ? '...' : '');

      let label = `Memory ${memoryIndex}`;
      let incrementMemoryIndex = true;
      if (result.content_type === 'conversation_summary') {
        label = 'Conversation Summary';
        incrementMemoryIndex = false;
      } else if (result.content_type === 'user_profile') {
        label = 'User Profile';
        incrementMemoryIndex = false;
      }

      const entryPrefix = `[${label}] (Similarity: ${(result.similarity_score * 100).toFixed(0)}%)\n` +
        `${result.message.role.toUpperCase()}: `;
      const entryText = `${entryPrefix}${snippet}`;
      const entryTokens = this.estimateTokens(entryText);

      if (usedTokens + entryTokens <= ragTokenBudget) {
        entries.push(entryText);
        usedTokens += entryTokens;
        if (incrementMemoryIndex) {
          memoryIndex += 1;
        }
        continue;
      }

      const remainingTokens = ragTokenBudget - usedTokens - this.estimateTokens(entryPrefix);
      if (remainingTokens <= 0) {
        break;
      }

      const trimmedSnippet = this.trimToTokenBudget(snippet, remainingTokens);
      if (!trimmedSnippet) {
        break;
      }

      entries.push(`${entryPrefix}${trimmedSnippet}`);
      usedTokens += this.estimateTokens(`${entryPrefix}${trimmedSnippet}`);
      if (incrementMemoryIndex) {
        memoryIndex += 1;
      }
      break;
    }

    if (entries.length === 0) {
      return '';
    }

    return `${header}${entries.join('\n\n')}${footer}`;
  }

  /**
   * Upsert conversation summary embedding
   */
  async upsertConversationSummaryEmbedding(conversationId: string, summary: string): Promise<void> {
    const summaryId = `summary_${conversationId}`;
    await this.retrieval.upsertDocumentEmbedding(summaryId, summary, {
      conversation_id: conversationId,
      content_type: 'conversation_summary',
      created_at: new Date().toISOString(),
      message_length: summary.length,
    });
  }

  /**
   * Upsert single-user profile embedding
   */
  async upsertUserProfileEmbedding(profile: string): Promise<void> {
    const profileId = 'profile_default';
    await this.retrieval.upsertDocumentEmbedding(profileId, profile, {
      content_type: 'user_profile',
      created_at: new Date().toISOString(),
      message_length: profile.length,
    });
  }

  /**
   * Delete single-user profile embedding
   */
  async deleteUserProfileEmbedding(): Promise<void> {
    await this.retrieval.deleteDocumentEmbedding('profile_default');
  }

  /**
   * Merge message, summary, and profile results without duplicates
   */
  private mergeResults(
    messageResults: RetrievalResult[],
    summaryResults: RetrievalResult[],
    profileResults: RetrievalResult[],
    topK?: number
  ): RetrievalResult[] {
    const limitedMessages = topK ? messageResults.slice(0, topK) : messageResults;
    const merged = [...limitedMessages, ...summaryResults, ...profileResults];
    const deduped = new Map<string, RetrievalResult>();
    merged.forEach(result => {
      const existing = deduped.get(result.message.id);
      if (!existing || result.similarity_score > existing.similarity_score) {
        deduped.set(result.message.id, result);
      }
    });
    return Array.from(deduped.values());
  }
}

/**
 * Global RAG manager instance
 */
let ragInstance: RAGManager | null = null;

/**
 * Get or create RAG manager instance
 */
export function getRAGManager(): RAGManager {
  if (!ragInstance) {
    ragInstance = new RAGManager();
  }
  return ragInstance;
}

/**
 * Initialize RAG manager
 */
export async function initializeRAG(): Promise<void> {
  const manager = getRAGManager();
  await manager.initialize();
}
