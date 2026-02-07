// app/lib/memory/rag/index.ts
// RAG (Retrieval-Augmented Generation) Orchestrator

import { LocalEmbeddings, getSharedEmbeddings } from './embeddings';
import { ChromaRetrieval } from './retrieval';
import { Message, AugmentedPrompt, RetrievalResult } from '../schemas';
import { getStorage } from '../storage';
import { logRetrievalMetrics, RetrievalMetrics } from '../metrics';
import { getMemoryConfig } from '../config';
import { deduplicateAndRerank, extractCodeIdentifiers } from './rerank';
import { memoryDebug } from '../debug';
import { recordMemoryFailure, recordMemorySuccess } from '../ops';
import { chunkMessage } from '../chunking';

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
      memoryDebug('[RAGManager] Initializing RAG system...');

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
      memoryDebug('[RAGManager] RAG system initialized successfully');
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
      const config = getMemoryConfig();

      // Add to Chroma for semantic search
      await this.retrieval.addMessageEmbedding(savedMessage);

      if (config.ragChunking) {
        try {
          const chunkDrafts = chunkMessage(savedMessage);
          if (chunkDrafts.length > 0) {
            const persistedChunks = storage.replaceMessageChunks(savedMessage.id, chunkDrafts);
            await this.retrieval.addMessageChunkEmbeddings(persistedChunks, savedMessage.role);
            memoryDebug(
              `[RAGManager] Added ${persistedChunks.length} chunks for message ${savedMessage.id}`
            );
          }
        } catch (chunkError) {
          recordMemoryFailure('embedding', 'RAGManager.processMessageForRAG.chunking', chunkError);
          console.warn('[RAGManager] Failed to chunk/embed message:', chunkError);
        }
      }

      // Update embedding metadata
      storage.updateEmbeddingStatus(
        `emb_${message.id}`,
        'success',
        message.id
      );

      memoryDebug(`[RAGManager] Message ${message.id} processed for RAG`);
    } catch (error) {
      recordMemoryFailure('embedding', 'RAGManager.processMessageForRAG', error);
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

      memoryDebug(`[RAGManager] Processed ${messages.length} messages for RAG`);
    } catch (error) {
      recordMemoryFailure('embedding', 'RAGManager.processMessagesForRAG', error);
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
    const storage = getStorage();

    const hasConversationHistory = Boolean(
      conversationId && storage.getConversationMessageCount(conversationId) > 0
    );
    const summary = conversationId ? storage.getConversationSummary(conversationId) : null;
    const shouldQuerySummary = Boolean(summary && summary.embedding_status === 'success');
    const profile = includeProfile ? storage.getUserProfile() : null;
    const shouldQueryProfile = Boolean(profile && profile.embedding_status === 'success');

    // Track timing for each source
    let denseStartTime = 0;
    let denseMs = 0;
    let ftsMs = 0;
    let rerankStartTime = 0;
    let rerankMs = 0;

    try {
      memoryDebug(
        `[RAGManager] Retrieving similar messages for: "${query.substring(0, 50)}..."`
      );

      let results: RetrievalResult[] = [];
      let conversationResults: RetrievalResult[] = [];
      let globalResults: RetrievalResult[] = [];
      let ftsResults: RetrievalResult[] = [];
      const retrievalLimit = topK ? topK * 2 : 10;

      // Phase 3: Hybrid Retrieval (Dense + FTS)
      if (config.ragHybrid) {
        memoryDebug('[RAGManager] Using hybrid retrieval (dense + FTS)');
        if (conversationId && !hasConversationHistory) {
          memoryDebug(
            `[RAGManager] Conversation ${conversationId} has no prior messages; falling back to global dense/FTS retrieval`
          );
        }

        // Run dense and FTS searches in parallel
        denseStartTime = Date.now();
        const ftsStartTime = Date.now();

        const [denseResults, lexicalResults] = await Promise.all([
          hasConversationHistory && conversationId
            ? this.retrieveWithFilters(
                query,
                { conversation_id: conversationId },
                retrievalLimit
              )
            : this.retrieval.search(query, retrievalLimit),
          // FTS retrieval (lexical)
          this.retrieval.ftsSearch(
            query,
            hasConversationHistory ? conversationId : undefined,
            retrievalLimit
          ),
        ]);

        denseMs = Date.now() - denseStartTime;
        ftsMs = Date.now() - ftsStartTime;

        if (hasConversationHistory) {
          conversationResults = denseResults;
        } else {
          globalResults = denseResults;
        }
        ftsResults = lexicalResults;

        // Rerank combined results
        rerankStartTime = Date.now();
        results = deduplicateAndRerank(
          hasConversationHistory ? conversationResults : globalResults,
          ftsResults,
          query
        );
        rerankMs = Date.now() - rerankStartTime;

        // Limit to topK after reranking
        if (topK) {
          results = results.slice(0, topK);
        }

        memoryDebug(
          `[RAGManager] Hybrid retrieval: ${conversationResults.length} conv-dense + ${globalResults.length} global-dense + ${ftsResults.length} FTS → ${results.length} reranked (dense: ${denseMs}ms, FTS: ${ftsMs}ms, rerank: ${rerankMs}ms)`
        );
      } else {
        // Phase 1-2: Dense-only retrieval (original behavior)
        denseStartTime = Date.now();
        if (hasConversationHistory && conversationId) {
          conversationResults = await this.retrieveWithFilters(
            query,
            { conversation_id: conversationId },
            topK
          );
          results = conversationResults;
        } else if (conversationId) {
          memoryDebug(
            `[RAGManager] Conversation ${conversationId} has no prior messages; skipping conversation-scoped dense retrieval`
          );
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
      if (conversationId && shouldQuerySummary) {
        summaryResults = await this.retrieveWithFilters(
          query,
          { conversation_id: conversationId, content_type: 'conversation_summary' },
          1
        );
      } else if (conversationId) {
        memoryDebug(
          `[RAGManager] Skipping summary retrieval for conversation ${conversationId} (no summary embedding ready)`
        );
      }

      // Profile retrieval (only if consent given)
      let profileResults: RetrievalResult[] = [];
      if (shouldQueryProfile) {
        profileResults = await this.retrieveWithFilters(
          query,
          { content_type: 'user_profile' },
          1
        );
      } else if (includeProfile) {
        memoryDebug('[RAGManager] Skipping profile retrieval (no profile embedding ready)');
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

      recordMemorySuccess('retrieval');
      return merged;
    } catch (error) {
      recordMemoryFailure('retrieval', 'RAGManager.retrieveSimilarMessages', error);
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
        content_type?: 'message' | 'message_chunk' | 'conversation_summary' | 'user_profile' | 'knowledge_chunk';
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
      memoryDebug('[RAGManager] RAG system cleared');
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
  buildMemoryContextBlock(retrievedContext: RetrievalResult[], query?: string): string {
    if (retrievedContext.length === 0) {
      return '';
    }
    const { ragTokenBudget } = getMemoryConfig();
    const header = '\n\n[Memory Context]\n' +
      'You have access to relevant memories from past conversations that may help answer the current question.\n\n';
    const footer = '\n\nUse these memories only if they are directly relevant.';
    let usedTokens = this.estimateTokens(header) + this.estimateTokens(footer);

    const orderedContext = this.orderContextForAssembly(retrievedContext, query);
    let memoryIndex = 1;
    const entries: string[] = [];

    for (const result of orderedContext) {
      const isChunk = result.content_type === 'message_chunk';
      const isCodeChunk = isChunk && result.chunk_kind === 'code';
      const maxMessageChars = isChunk ? 900 : 260;
      const snippet = result.message.content.length > maxMessageChars
        ? `${result.message.content.slice(0, maxMessageChars).trimEnd()}...`
        : result.message.content;

      let label = `Memory ${memoryIndex}`;
      let incrementMemoryIndex = true;
      if (result.content_type === 'conversation_summary') {
        label = 'Conversation Summary';
        incrementMemoryIndex = false;
      } else if (result.content_type === 'user_profile') {
        label = 'User Profile';
        incrementMemoryIndex = false;
      } else if (isCodeChunk) {
        label = `Code Chunk ${result.chunk_index ?? memoryIndex}`;
      } else if (isChunk) {
        label = `Context Chunk ${result.chunk_index ?? memoryIndex}`;
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

      if (entries.length === 0) {
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
      }
    }

    if (entries.length === 0) {
      return '';
    }

    return `${header}${entries.join('\n\n')}${footer}`;
  }

  private orderContextForAssembly(results: RetrievalResult[], query?: string): RetrievalResult[] {
    const config = getMemoryConfig();
    if (!config.ragChunking) {
      return results;
    }

    if (!this.isCodeHeavyQuery(query)) {
      return results;
    }

    const hasCodeChunk = results.some(
      result => result.content_type === 'message_chunk' && result.chunk_kind === 'code'
    );
    if (!hasCodeChunk) {
      return results;
    }

    const sorted = [...results];
    sorted.sort((a, b) => {
      const priorityA = this.getContextPriority(a);
      const priorityB = this.getContextPriority(b);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return b.similarity_score - a.similarity_score;
    });
    return sorted;
  }

  private isCodeHeavyQuery(query?: string): boolean {
    if (!query) return false;
    if (extractCodeIdentifiers(query).size > 0) return true;
    if (/```|`|::|=>|[{}()[\];]/.test(query)) return true;
    const keywordRegex = /\b(function|class|interface|sql|query|api|typescript|python|javascript|schema)\b/i;
    return keywordRegex.test(query);
  }

  private getContextPriority(result: RetrievalResult): number {
    if (result.content_type === 'message_chunk' && result.chunk_kind === 'code') return 0;
    if (result.content_type === 'message_chunk') return 1;
    if (result.content_type === 'conversation_summary') return 2;
    if (result.content_type === 'user_profile') return 3;
    return 4;
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
