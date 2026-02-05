// app/lib/memory/storage/sqlite.ts
// Production-grade SQLite wrapper using better-sqlite3

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  Message,
  Conversation,
  UserPreference,
  EmbeddingMetadata,
  Session,
  ConversationSummary,
  UserProfile,
} from '../schemas';

/**
 * SQLite Storage Implementation
 * Handles all database operations with prepared statements
 * Thread-safe and optimized for Next.js
 */
export class SQLiteStorage {
  private db: Database.Database;
  private initialized: boolean = false;

  constructor(dbPath: string) {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    this.db.pragma('foreign_keys = ON'); // Enable foreign key constraints
  }

  /**
   * Initialize database schema and run migrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const migrationsDir = path.join(process.cwd(), 'app/lib/memory/migrations');

    // Get all migration files in order
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ensures init.sql runs before 002_strategy_analytics.sql

    console.log(`[SQLite] Running ${migrationFiles.length} migrations...`);

    // Run each migration file
    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      // Split migration into individual statements and execute
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      statements.forEach(statement => {
        try {
          this.db.exec(statement);
        } catch (error) {
          // Ignore "already exists" errors
          if (!(error instanceof Error) || !error.message.includes('already exists')) {
            console.error(`[SQLite] Error in ${migrationFile}:`, error);
            throw error;
          }
        }
      });

      console.log(`[SQLite] ✓ Applied migration: ${migrationFile}`);
    }

    this.initialized = true;
    console.log('[SQLite] Database initialized successfully');
  }

  /**
   * CREATE: Save a new conversation
   */
  saveConversation(conversation: Omit<Conversation, 'created_at' | 'updated_at'>): Conversation {
    const id = conversation.id || this.generateId('conv');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, model_used, total_tokens, summary, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      conversation.title,
      now,
      now,
      conversation.model_used || null,
      conversation.total_tokens,
      conversation.summary || null,
      conversation.tags ? JSON.stringify(conversation.tags) : null
    );

    return {
      ...conversation,
      id,
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * READ: Get conversation by ID
   */
  getConversation(conversationId: string): Conversation | null {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations WHERE id = ?
    `);

    const row = stmt.get(conversationId) as any;
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      model_used: row.model_used,
      total_tokens: row.total_tokens,
      summary: row.summary,
      tags: row.tags ? JSON.parse(row.tags) : [],
    };
  }

  /**
   * READ: Get all conversations (with pagination)
   */
  getAllConversations(limit: number = 50, offset: number = 0): Conversation[] {
    const stmt = this.db.prepare(`
      SELECT * FROM conversations 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as any[];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      model_used: row.model_used,
      total_tokens: row.total_tokens,
      summary: row.summary,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));
  }

  /**
   * CREATE: Save a message
   */
  saveMessage(message: Omit<Message, 'created_at'>): Message {
    const id = message.id || this.generateId('msg');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO messages 
      (id, conversation_id, role, content, created_at, tokens_used, tool_calls, tool_results, model_used, temperature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      message.conversation_id,
      message.role,
      message.content,
      now,
      message.tokens_used || null,
      message.tool_calls ? JSON.stringify(message.tool_calls) : null,
      message.tool_results ? JSON.stringify(message.tool_results) : null,
      message.model_used || null,
      message.temperature || null
    );

    return {
      ...message,
      id,
      created_at: now,
    };
  }

  /**
   * READ: Get message by ID
   */
  getMessage(messageId: string): Message | null {
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE id = ?
    `);

    const row = stmt.get(messageId) as any;
    if (!row) return null;

    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used,
      temperature: row.temperature,
    };
  }

  /**
   * READ: Get all messages in a conversation
   */
  getConversationMessages(conversationId: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(conversationId) as any[];
    return rows.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used,
      temperature: row.temperature,
    }));
  }

  /**
   * READ: Search messages by role and date range
   */
  searchMessages(
    conversationId: string,
    role?: 'user' | 'assistant',
    fromDate?: Date,
    toDate?: Date
  ): Message[] {
    let query = `SELECT * FROM messages WHERE conversation_id = ?`;
    const params: any[] = [conversationId];

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    if (fromDate) {
      query += ` AND created_at >= ?`;
      params.push(fromDate.toISOString());
    }

    if (toDate) {
      query += ` AND created_at <= ?`;
      params.push(toDate.toISOString());
    }

    query += ` ORDER BY created_at ASC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used,
      temperature: row.temperature,
    }));
  }

  /**
   * READ: Get count of messages in a conversation (for summary frequency)
   */
  getConversationMessageCount(conversationId: string, role?: 'user' | 'assistant'): number {
    let query = `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`;
    const params: any[] = [conversationId];

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as any;
    return row?.count || 0;
  }

  /**
   * UPDATE: Update conversation
   */
  updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const now = new Date().toISOString();
    const allowedFields = ['title', 'model_used', 'total_tokens', 'summary', 'tags'];
    const setClauses: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        if (key === 'tags' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    });

    values.push(conversationId);

    const stmt = this.db.prepare(`
      UPDATE conversations 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * DELETE: Delete a conversation and all its messages
   */
  deleteConversation(conversationId: string): void {
    const stmt = this.db.prepare(`DELETE FROM conversations WHERE id = ?`);
    stmt.run(conversationId);
  }

  /**
   * PREFERENCES: Set or update a user preference
   */
  setPreference(key: string, value: string | number | boolean | object, dataType?: string): void {
    const now = new Date().toISOString();
    let valueStr = String(value);
    let type = dataType || 'string';

    if (typeof value === 'object') {
      valueStr = JSON.stringify(value);
      type = 'json';
    } else if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    }

    const stmt = this.db.prepare(`
      INSERT INTO user_preferences (key, value, data_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        data_type = excluded.data_type,
        updated_at = excluded.updated_at
    `);

    stmt.run(key, valueStr, type, now, now);
  }

  /**
   * PREFERENCES: Get a user preference
   */
  getPreference(key: string): UserPreference | null {
    const stmt = this.db.prepare(`SELECT * FROM user_preferences WHERE key = ?`);
    const row = stmt.get(key) as any;

    if (!row) return null;

    return {
      key: row.key,
      value: row.value,
      data_type: row.data_type,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * PREFERENCES: Get all user preferences
   */
  getAllPreferences(): Record<string, any> {
    const stmt = this.db.prepare(`SELECT * FROM user_preferences`);
    const rows = stmt.all() as any[];

    const result: Record<string, any> = {};
    rows.forEach(row => {
      if (row.data_type === 'json') {
        result[row.key] = JSON.parse(row.value);
      } else if (row.data_type === 'number') {
        result[row.key] = Number(row.value);
      } else if (row.data_type === 'boolean') {
        result[row.key] = row.value === 'true';
      } else {
        result[row.key] = row.value;
      }
    });

    return result;
  }

  /**
   * SUMMARY: Upsert conversation summary
   */
  saveConversationSummary(
    conversationId: string,
    summary: string,
    contentHash?: string
  ): ConversationSummary {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO conversation_summaries (conversation_id, summary, updated_at, content_hash, embedding_status, error_message)
      VALUES (?, ?, ?, ?, 'pending', NULL)
      ON CONFLICT(conversation_id) DO UPDATE SET
        summary = excluded.summary,
        updated_at = excluded.updated_at,
        content_hash = excluded.content_hash,
        embedding_status = 'pending',
        error_message = NULL
    `);

    stmt.run(conversationId, summary, now, contentHash || null);

    // Keep conversations.summary in sync
    const updateConversation = this.db.prepare(`
      UPDATE conversations
      SET summary = ?, updated_at = ?
      WHERE id = ?
    `);
    updateConversation.run(summary, now, conversationId);

    return {
      conversation_id: conversationId,
      summary,
      updated_at: now,
      content_hash: contentHash,
      embedding_status: 'pending',
    };
  }

  /**
   * SUMMARY: Get conversation summary
   */
  getConversationSummary(conversationId: string): ConversationSummary | null {
    const stmt = this.db.prepare(`
      SELECT * FROM conversation_summaries WHERE conversation_id = ?
    `);
    const row = stmt.get(conversationId) as any;
    if (!row) return null;

    return {
      conversation_id: row.conversation_id,
      summary: row.summary,
      updated_at: row.updated_at,
      content_hash: row.content_hash,
      embedding_status: row.embedding_status,
      error_message: row.error_message || undefined,
    };
  }

  /**
   * SUMMARY: Update summary embedding status
   */
  updateConversationSummaryEmbeddingStatus(
    conversationId: string,
    status: 'success' | 'failed',
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE conversation_summaries
      SET embedding_status = ?, error_message = ?
      WHERE conversation_id = ?
    `);
    stmt.run(status, errorMessage || null, conversationId);
  }

  /**
   * PROFILE: Upsert single-user profile
   */
  saveUserProfile(profile: string, contentHash?: string): UserProfile {
    const now = new Date().toISOString();
    const id = 'default';

    const stmt = this.db.prepare(`
      INSERT INTO user_profile (id, profile, updated_at, content_hash, embedding_status, error_message)
      VALUES (?, ?, ?, ?, 'pending', NULL)
      ON CONFLICT(id) DO UPDATE SET
        profile = excluded.profile,
        updated_at = excluded.updated_at,
        content_hash = excluded.content_hash,
        embedding_status = 'pending',
        error_message = NULL
    `);

    stmt.run(id, profile, now, contentHash || null);

    return {
      id,
      profile,
      updated_at: now,
      content_hash: contentHash,
      embedding_status: 'pending',
    };
  }

  /**
   * PROFILE: Get single-user profile
   */
  getUserProfile(): UserProfile | null {
    const stmt = this.db.prepare(`SELECT * FROM user_profile WHERE id = 'default'`);
    const row = stmt.get() as any;
    if (!row) return null;

    return {
      id: row.id,
      profile: row.profile,
      updated_at: row.updated_at,
      content_hash: row.content_hash,
      embedding_status: row.embedding_status,
      error_message: row.error_message || undefined,
    };
  }

  /**
   * PROFILE: Update profile embedding status
   */
  updateUserProfileEmbeddingStatus(
    status: 'success' | 'failed',
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE user_profile
      SET embedding_status = ?, error_message = ?
      WHERE id = 'default'
    `);
    stmt.run(status, errorMessage || null);
  }

  /**
   * PROFILE: Delete single-user profile
   */
  deleteUserProfile(): void {
    const stmt = this.db.prepare(`DELETE FROM user_profile WHERE id = 'default'`);
    stmt.run();
  }

  /**
   * EMBEDDING METADATA: Track embedding status
   */
  saveEmbeddingMetadata(metadata: Omit<EmbeddingMetadata, 'created_at'>): EmbeddingMetadata {
    const id = metadata.id || this.generateId('emb');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO embedding_metadata 
      (id, message_id, conversation_id, chroma_id, created_at, embedding_status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      metadata.message_id,
      metadata.conversation_id,
      metadata.chroma_id || null,
      now,
      metadata.embedding_status,
      metadata.error_message || null
    );

    return {
      ...metadata,
      id,
      created_at: now,
    };
  }

  /**
   * EMBEDDING METADATA: Get pending embeddings
   */
  getPendingEmbeddings(limit: number = 100): EmbeddingMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM embedding_metadata 
      WHERE embedding_status = 'pending'
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => ({
      id: row.id,
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      chroma_id: row.chroma_id,
      created_at: row.created_at,
      embedding_status: row.embedding_status,
      error_message: row.error_message,
    }));
  }

  /**
   * EMBEDDING METADATA: Update embedding status
   */
  updateEmbeddingStatus(
    embeddingId: string,
    status: 'success' | 'failed',
    chromaId?: string,
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE embedding_metadata 
      SET embedding_status = ?, chroma_id = ?, error_message = ?
      WHERE id = ?
    `);

    stmt.run(status, chromaId || null, errorMessage || null, embeddingId);
  }

  /**
   * SESSION: Create or update a session
   */
  saveSession(session: Omit<Session, 'created_at' | 'last_activity'>): Session {
    const id = session.id || this.generateId('sess');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, user_id, created_at, last_activity, context_tokens_used)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_activity = excluded.last_activity,
        context_tokens_used = excluded.context_tokens_used
    `);

    stmt.run(
      id,
      session.user_id,
      now,
      now,
      session.context_tokens_used
    );

    return {
      ...session,
      id,
      created_at: now,
      last_activity: now,
    };
  }

  /**
   * SESSION: Get session by ID
   */
  getSession(sessionId: string): Session | null {
    const stmt = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`);
    const row = stmt.get(sessionId) as any;

    if (!row) return null;

    return {
      id: row.id,
      user_id: row.user_id,
      created_at: row.created_at,
      last_activity: row.last_activity,
      context_tokens_used: row.context_tokens_used,
    };
  }

  /**
   * SESSION: Update session activity
   */
  updateSessionActivity(sessionId: string, contextTokensUsed?: number): void {
    const now = new Date().toISOString();

    if (contextTokensUsed !== undefined) {
      const stmt = this.db.prepare(`
        UPDATE sessions
        SET last_activity = ?, context_tokens_used = context_tokens_used + ?
        WHERE id = ?
      `);
      stmt.run(now, contextTokensUsed, sessionId);
    } else {
      const stmt = this.db.prepare(`
        UPDATE sessions
        SET last_activity = ?
        WHERE id = ?
      `);
      stmt.run(now, sessionId);
    }
  }

  /**
   * SESSION: Delete old/inactive sessions
   */
  deleteInactiveSessions(daysInactive: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

    const stmt = this.db.prepare(`
      DELETE FROM sessions
      WHERE last_activity < ?
    `);

    stmt.run(cutoffDate.toISOString());
  }

  /**
   * ANALYTICS: Log a search query
   */
  logSearchQuery(
    query: string,
    retrievedCount: number,
    topSimilarity: number,
    responsTimeMs: number
  ): void {
    const id = this.generateId('search');
    const stmt = this.db.prepare(`
      INSERT INTO search_queries
      (id, query, retrieved_messages_count, top_similarity_score, created_at, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, query, retrievedCount, topSimilarity, new Date().toISOString(), responsTimeMs);
  }

  /**
   * UTILITY: Get database statistics
   */
  getStats(): {
    total_conversations: number;
    total_messages: number;
    pending_embeddings: number;
    total_tokens: number;
    oldest_message: string | null;
    newest_message: string | null;
  } {
    const conversationCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as any
    ).count;

    const messageCount = (this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as any)
      .count;

    const pendingCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM embedding_metadata WHERE embedding_status = ?').get('pending') as any
    ).count;

    const totalTokens = (
      this.db.prepare('SELECT SUM(tokens_used) as total FROM messages').get() as any
    ).total || 0;

    const oldestMsg = (
      this.db.prepare('SELECT created_at FROM messages ORDER BY created_at ASC LIMIT 1').get() as any
    )?.created_at || null;

    const newestMsg = (
      this.db.prepare('SELECT created_at FROM messages ORDER BY created_at DESC LIMIT 1').get() as any
    )?.created_at || null;

    return {
      total_conversations: conversationCount,
      total_messages: messageCount,
      pending_embeddings: pendingCount,
      total_tokens: totalTokens,
      oldest_message: oldestMsg,
      newest_message: newestMsg,
    };
  }

  /**
   * STRATEGY ANALYTICS: Save a strategy decision
   */
  saveStrategyDecision(decision: {
    id?: string;
    conversation_id: string;
    message_id?: string;
    strategy_name: string;
    selected_model: string;
    reasoning: string;
    confidence: number;
    context_complexity: string;
    complexity_score: number;
    decision_time_ms: number;
  }): string {
    const id = decision.id || this.generateId('strat');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO strategy_decisions
      (id, conversation_id, message_id, strategy_name, selected_model, reasoning,
       confidence, context_complexity, complexity_score, decision_time_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      decision.conversation_id,
      decision.message_id || null,
      decision.strategy_name,
      decision.selected_model,
      decision.reasoning,
      decision.confidence,
      decision.context_complexity,
      decision.complexity_score,
      decision.decision_time_ms,
      now
    );

    return id;
  }

  /**
   * STRATEGY ANALYTICS: Save a strategy outcome
   */
  saveStrategyOutcome(outcome: {
    id?: string;
    decision_id: string;
    response_quality?: number;
    user_feedback?: 'positive' | 'negative' | 'neutral';
    response_time_ms: number;
    tokens_used: number;
    error_occurred: boolean;
    retry_count?: number;
  }): string {
    const id = outcome.id || this.generateId('outcome');
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO strategy_outcomes
      (id, decision_id, response_quality, user_feedback, response_time_ms,
       tokens_used, error_occurred, retry_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      outcome.decision_id,
      outcome.response_quality || 0.8,
      outcome.user_feedback || null,
      outcome.response_time_ms,
      outcome.tokens_used,
      outcome.error_occurred ? 1 : 0,
      outcome.retry_count || 0,
      now
    );

    return id;
  }

  /**
   * STRATEGY ANALYTICS: Get strategy performance metrics
   */
  getStrategyPerformance(strategyName: string): {
    total_decisions: number;
    avg_response_time: number;
    avg_tokens_used: number;
    success_rate: number;
    avg_quality: number;
  } | null {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_decisions,
        AVG(o.response_time_ms) as avg_response_time,
        AVG(o.tokens_used) as avg_tokens_used,
        (1.0 - AVG(CAST(o.error_occurred AS REAL))) as success_rate,
        AVG(o.response_quality) as avg_quality
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      WHERE d.strategy_name = ?
    `);

    const row = stmt.get(strategyName) as any;

    if (!row || row.total_decisions === 0) return null;

    return {
      total_decisions: row.total_decisions,
      avg_response_time: Math.round(row.avg_response_time || 0),
      avg_tokens_used: Math.round(row.avg_tokens_used || 0),
      success_rate: row.success_rate || 0,
      avg_quality: row.avg_quality || 0
    };
  }

  /**
   * STRATEGY ANALYTICS: Get model performance metrics
   */
  getModelPerformance(modelName: string): {
    total_usage: number;
    avg_response_time: number;
    avg_tokens_used: number;
    success_rate: number;
    avg_quality: number;
  } | null {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_usage,
        AVG(o.response_time_ms) as avg_response_time,
        AVG(o.tokens_used) as avg_tokens_used,
        (1.0 - AVG(CAST(o.error_occurred AS REAL))) as success_rate,
        AVG(o.response_quality) as avg_quality
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      WHERE d.selected_model = ?
    `);

    const row = stmt.get(modelName) as any;

    if (!row || row.total_usage === 0) return null;

    return {
      total_usage: row.total_usage,
      avg_response_time: Math.round(row.avg_response_time || 0),
      avg_tokens_used: Math.round(row.avg_tokens_used || 0),
      success_rate: row.success_rate || 0,
      avg_quality: row.avg_quality || 0
    };
  }

  /**
   * STRATEGY ANALYTICS: Get recent strategy decisions
   */
  getRecentStrategyDecisions(limit: number = 10): any[] {
    const stmt = this.db.prepare(`
      SELECT
        d.*,
        o.response_time_ms,
        o.tokens_used,
        o.error_occurred,
        o.response_quality
      FROM strategy_decisions d
      LEFT JOIN strategy_outcomes o ON d.id = o.decision_id
      ORDER BY d.created_at DESC
      LIMIT ?
    `);

    return stmt.all(limit) as any[];
  }

  /**
   * UTILITY: Close database connection
   */
  close(): void {
    this.db.close();
    console.log('[SQLite] Database closed');
  }

  /**
   * UTILITY: Get direct database access for advanced queries
   * Phase 3: Used for FTS queries
   */
  getDatabase(): Database.Database {
    return this.db;
  }

  /**
   * UTILITY: Generate unique IDs
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
