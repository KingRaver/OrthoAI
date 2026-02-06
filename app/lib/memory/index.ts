// app/lib/memory/index.ts
// Memory system main export - MemoryManager orchestrates storage and RAG

import { SQLiteStorage } from './storage/sqlite';
import { RAGManager } from './rag';
import { extractCodeIdentifiers } from './rag/rerank';
import { Conversation, Message, AugmentedPrompt, ConversationSummary, UserProfile } from './schemas';
import { getMemoryConfig } from './config';
import { getDefaultModel, getLlmChatUrl } from '@/app/lib/llm/config';
import { createHash } from 'crypto';

let storageInstance: SQLiteStorage | null = null;

class TaskQueue {
  private queue: Array<() => Promise<void>> = [];
  private active = 0;
  private concurrency: number;

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  enqueue(task: () => Promise<void>): void {
    this.queue.push(task);
    this.runNext();
  }

  getDepth(): number {
    return this.queue.length;
  }

  private runNext(): void {
    if (this.active >= this.concurrency) return;
    const task = this.queue.shift();
    if (!task) return;
    this.active += 1;
    task()
      .catch(() => {})
      .finally(() => {
        this.active -= 1;
        this.runNext();
      });
  }
}

/**
 * Get or create SQLite storage instance (singleton)
 * Ensures only one database connection across the app
 */
export function getStorage(): SQLiteStorage {
  if (!storageInstance) {
    const dbPath = process.env.MEMORY_DB_PATH || './.data/orthoai.db';
    storageInstance = new SQLiteStorage(dbPath);
  }
  return storageInstance;
}

/**
 * Initialize storage (call once at app startup)
 */
export async function initializeStorage(): Promise<void> {
  const storage = getStorage();
  await storage.initialize();
}

/**
 * Close storage connection
 */
export function closeStorage(): void {
  if (storageInstance) {
    storageInstance.close();
    storageInstance = null;
  }
}

/**
 * MemoryManager - High-level API for memory operations
 * Combines SQLite storage with RAG retrieval
 */
export class MemoryManager {
  private storage: SQLiteStorage;
  private rag: RAGManager;
  private initialized: boolean = false;
  private embeddingQueue = new TaskQueue(2);
  private summaryQueue = new TaskQueue(1);

  constructor() {
    this.storage = getStorage();
    this.rag = new RAGManager();
  }

  /**
   * Initialize the memory system
   * Call once at startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.storage.initialize();
      await this.rag.initialize();
      this.initialized = true;
      console.log('[MemoryManager] Memory system initialized');
    } catch (error) {
      console.error('[MemoryManager] Error initializing:', error);
      // Don't throw - allow graceful degradation
    }
  }

  /**
   * Create a new conversation
   */
  createConversation(title: string, model?: string): Conversation {
    return this.storage.saveConversation({
      id: this.generateId('conv'),
      title,
      model_used: model,
      total_tokens: 0,
      tags: [],
    });
  }

  /**
   * Save a message to storage and process for RAG
   */
  async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: {
      model_used?: string;
      tokens_used?: number;
      temperature?: number;
    }
  ): Promise<Message> {
    const codeIdentifiers = extractCodeIdentifiers(content);
    const message = this.storage.saveMessage({
      id: this.generateId('msg'),
      conversation_id: conversationId,
      role,
      content,
      tokens_used: metadata?.tokens_used,
      model_used: metadata?.model_used,
      temperature: metadata?.temperature,
      code_identifiers: Array.from(codeIdentifiers),
    });

    // Track embedding status (pending) for this message
    try {
      this.storage.saveEmbeddingMetadata({
        id: `emb_${message.id}`,
        message_id: message.id,
        conversation_id: message.conversation_id,
        embedding_status: 'pending'
      });
    } catch (error) {
      console.warn('[MemoryManager] Error saving embedding metadata:', error);
    }

    // Process message for RAG (async, don't await)
    this.embeddingQueue.enqueue(async () => {
      try {
        await this.rag.processMessageForRAG(message);
      } catch (error) {
        console.warn('[MemoryManager] Error processing message for RAG:', error);
      }
    });

    // Phase 2: Auto-generate conversation summary after N assistant messages
    if (role === 'assistant') {
      const config = getMemoryConfig();
      const freq = config.ragSummaryFrequency;

      if (freq > 0) {
        const count = this.getConversationMessageCount(conversationId, 'assistant');

        if (count % freq === 0) {
          // Generate summary asynchronously (don't block message saving)
          this.summaryQueue.enqueue(async () => {
            try {
              await this.generateConversationSummary(conversationId);
            } catch (error) {
              console.warn('[MemoryManager] Error generating conversation summary:', error);
            }
          });
        }
      }
    }

    return message;
  }

  /**
   * Augment a user message with retrieved context from memory
   */
  async augmentWithMemory(
    userMessage: string,
    topK: number = 5,
    conversationId?: string
  ): Promise<AugmentedPrompt> {
    try {
      const includeProfile = this.isProfileConsentGranted();
      return await this.rag.augmentPrompt(userMessage, topK, conversationId, includeProfile);
    } catch (error) {
      console.error('[MemoryManager] Error augmenting with memory:', error);
      return {
        original_query: userMessage,
        retrieved_context: [],
        enhanced_system_prompt: 'You are OrthoAI - a focused orthopedic research assistant.',
      };
    }
  }

  /**
   * Save or update a conversation summary and embed it for retrieval
   */
  async saveConversationSummary(conversationId: string, summary: string): Promise<void> {
    const contentHash = this.hashContent(summary);
    const existing = this.storage.getConversationSummary(conversationId);
    if (existing && existing.content_hash === contentHash) {
      return;
    }

    this.storage.saveConversationSummary(conversationId, summary, contentHash);

    try {
      await this.rag.upsertConversationSummaryEmbedding(conversationId, summary);
      this.storage.updateConversationSummaryEmbeddingStatus(conversationId, 'success');
    } catch (error) {
      this.storage.updateConversationSummaryEmbeddingStatus(
        conversationId,
        'failed',
        (error as Error).message
      );
    }
  }

  /**
   * Generate a conversation summary using recent messages
   * Phase 2: Called automatically every N messages
   */
  async generateConversationSummary(conversationId: string): Promise<void> {
    console.log(`[MemoryManager] Starting summary generation for conversation ${conversationId}`);

    try {
      // Fetch last 10 messages from the conversation (DB-limited)
      const recentMessagesDesc = this.storage.getConversationMessages(conversationId, {
        limit: 10,
        order: 'desc'
      });
      const recentMessages = recentMessagesDesc.reverse();

      console.log(`[MemoryManager] Found ${recentMessages.length} messages to summarize`);

      if (recentMessages.length === 0) {
        console.warn('[MemoryManager] No messages to summarize');
        return;
      }

      // Format messages for summarization
      const messageText = recentMessages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      // Build summarization prompt
      const summaryPrompt = `Please provide a concise summary of this conversation focusing on:
1. Key clinical or research topics discussed
2. Evidence or studies referenced (if any)
3. Hypotheses, mechanisms, or study design ideas worth tracking

Conversation:
${messageText}

Summary (2-3 sentences):`;

      // Call LLM API to generate summary
      const summaryModel = process.env.SUMMARY_MODEL || getDefaultModel();
      const response = await fetch(getLlmChatUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: summaryModel,
          messages: [
            {
              role: 'system',
              content: 'You are OrthoAI. Produce a concise research summary with key topics, evidence, and hypotheses.'
            },
            {
              role: 'user',
              content: summaryPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 300,
          stream: false,
        }),
      });

      console.log(`[MemoryManager] LLM response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content?.trim();

      console.log(`[MemoryManager] Generated summary length: ${summary?.length || 0} chars`);

      if (summary) {
        // Save the summary and create embeddings
        await this.saveConversationSummary(conversationId, summary);
        console.log(`[MemoryManager] ✓ Summary saved for conversation ${conversationId}`);
      } else {
        console.warn('[MemoryManager] Summary was empty or undefined');
      }
    } catch (error) {
      console.error('[MemoryManager] ✗ Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Get a conversation summary
   */
  getConversationSummary(conversationId: string): ConversationSummary | null {
    return this.storage.getConversationSummary(conversationId);
  }

  /**
   * Save or update the single-user profile (requires explicit consent)
   */
  async saveUserProfile(profile: string, consent: boolean): Promise<void> {
    if (!consent) {
      console.warn('[MemoryManager] Profile update skipped: consent not granted');
      return;
    }

    this.setProfileConsent(true);
    const contentHash = this.hashContent(profile);
    const existing = this.storage.getUserProfile();
    if (existing && existing.content_hash === contentHash) {
      return;
    }

    this.storage.saveUserProfile(profile, contentHash);

    try {
      await this.rag.upsertUserProfileEmbedding(profile);
      this.storage.updateUserProfileEmbeddingStatus('success');
    } catch (error) {
      this.storage.updateUserProfileEmbeddingStatus(
        'failed',
        (error as Error).message
      );
    }
  }

  /**
   * Get the single-user profile
   */
  getUserProfile(): UserProfile | null {
    return this.storage.getUserProfile();
  }

  /**
   * Clear single-user profile data and embeddings
   */
  async clearUserProfile(): Promise<void> {
    try {
      this.storage.deleteUserProfile();
      await this.rag.deleteUserProfileEmbedding();
    } catch (error) {
      console.warn('[MemoryManager] Failed to clear user profile:', error);
    }
  }

  /**
   * Set profile consent (local only)
   */
  setProfileConsent(consent: boolean): void {
    this.storage.setPreference('memory_profile_consent', consent);
  }

  /**
   * Check whether profile consent is granted
   */
  isProfileConsentGranted(): boolean {
    const pref = this.storage.getPreference('memory_profile_consent');
    return pref?.data_type === 'boolean' ? pref.value === 'true' : false;
  }

  /**
   * Get a conversation by ID
   */
  getConversation(conversationId: string): Conversation | null {
    return this.storage.getConversation(conversationId);
  }

  /**
   * Get all messages in a conversation
   */
  getConversationMessages(
    conversationId: string,
    options?: { limit?: number; order?: 'asc' | 'desc' }
  ): Message[] {
    return this.storage.getConversationMessages(conversationId, options);
  }

  /**
   * Get count of messages in a conversation
   * Used for summary generation frequency (Phase 2)
   */
  getConversationMessageCount(conversationId: string, role?: 'user' | 'assistant'): number {
    return this.storage.getConversationMessageCount(conversationId, role);
  }

  /**
   * Get all conversations
   */
  getAllConversations(limit?: number, offset?: number): Conversation[] {
    return this.storage.getAllConversations(limit, offset);
  }

  /**
   * Update a conversation
   */
  updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    this.storage.updateConversation(conversationId, updates);
  }

  /**
   * Delete a conversation
   */
  deleteConversation(conversationId: string): void {
    this.storage.deleteConversation(conversationId);
  }

  /**
   * Get memory system statistics
   */
  async getStats() {
    const sqliteStats = this.storage.getStats();
    const ragStats = await this.rag.getStats();
    return {
      sqlite: sqliteStats,
      rag: ragStats,
    };
  }

  getQueueDepths(): { embeddings: number; summaries: number } {
    return {
      embeddings: this.embeddingQueue.getDepth(),
      summaries: this.summaryQueue.getDepth()
    };
  }

  /**
   * Format retrieved context for logging
   */
  formatContextForLogging(augmented: AugmentedPrompt): string {
    return this.rag.formatContextForLogging(augmented);
  }

  /**
   * Build a memory context block to append to system prompts
   */
  buildMemoryContextBlock(augmented: AugmentedPrompt): string {
    return this.rag.buildMemoryContextBlock(augmented.retrieved_context);
  }

  /**
   * Generate unique IDs
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Create a stable hash for content change detection
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

/**
 * Global MemoryManager instance
 */
let memoryManagerInstance: MemoryManager | null = null;

/**
 * Get or create MemoryManager instance (singleton)
 */
export function getMemoryManager(): MemoryManager {
  if (!memoryManagerInstance) {
    memoryManagerInstance = new MemoryManager();
  }
  return memoryManagerInstance;
}

/**
 * Initialize memory system (call once at app startup)
 */
export async function initializeMemory(): Promise<void> {
  const manager = getMemoryManager();
  await manager.initialize();
}

export { SQLiteStorage };
