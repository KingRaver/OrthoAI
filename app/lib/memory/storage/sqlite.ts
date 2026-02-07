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
  MessageChunk,
  MessageChunkKind,
  SummaryJobState,
  SummaryHealthRecord,
  SummaryEventRecord,
  SummaryHealthSnapshot,
} from '../schemas';

type PreferenceValue = string | number | boolean | null | object;

type ConversationRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  model_used: string | null;
  total_tokens: number;
  summary: string | null;
  tags: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: Message['role'];
  content: string;
  created_at: string;
  tokens_used: number | null;
  tool_calls: string | null;
  tool_results: string | null;
  model_used: string | null;
  temperature: number | null;
  code_identifiers: string | null;
};

type MessageChunkRow = {
  id: string;
  parent_message_id: string;
  conversation_id: string;
  chunk_index: number;
  chunk_kind: MessageChunkKind;
  content: string;
  language: string | null;
  token_estimate: number;
  created_at: string;
};

type UserPreferenceRow = {
  key: string;
  value: string;
  data_type: UserPreference['data_type'];
  created_at: string;
  updated_at: string;
};

type ConversationSummaryRow = {
  conversation_id: string;
  summary: string;
  updated_at: string;
  content_hash: string | null;
  embedding_status: ConversationSummary['embedding_status'];
  error_message: string | null;
};

type UserProfileRow = {
  id: string;
  profile: string;
  updated_at: string;
  content_hash: string | null;
  embedding_status: UserProfile['embedding_status'];
  error_message: string | null;
};

type SummaryHealthRow = {
  conversation_id: string;
  last_state: SummaryJobState;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_runs: number;
  total_successes: number;
  total_failures: number;
  total_retries: number;
  updated_at: string;
};

type SummaryEventRow = {
  id: string;
  conversation_id: string;
  state: SummaryJobState;
  attempt: number;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
};

type EmbeddingMetadataRow = {
  id: string;
  message_id: string;
  conversation_id: string;
  chroma_id: string | null;
  created_at: string;
  embedding_status: EmbeddingMetadata['embedding_status'];
  error_message: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  last_activity: string;
  context_tokens_used: number;
};

type CountRow = { count: number };
type SumRow = { total: number | null };
type CreatedAtRow = { created_at: string };

type StrategyPerformanceRow = {
  total_decisions: number;
  avg_response_time: number | null;
  avg_tokens_used: number | null;
  success_rate: number | null;
  avg_quality: number | null;
};

type ModelPerformanceRow = {
  total_usage: number;
  avg_response_time: number | null;
  avg_tokens_used: number | null;
  success_rate: number | null;
  avg_quality: number | null;
};

type StrategyDecisionRow = {
  id: string;
  conversation_id: string;
  message_id: string | null;
  strategy_name: string;
  selected_model: string;
  reasoning: string;
  confidence: number;
  context_complexity: string;
  complexity_score: number;
  decision_time_ms: number;
  created_at: string;
  response_time_ms: number | null;
  tokens_used: number | null;
  error_occurred: number | null;
  response_quality: number | null;
};

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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = this.db.prepare(`SELECT name FROM schema_migrations`).all() as Array<{ name: string }>;
    const appliedMigrations = new Set(appliedRows.map(row => row.name));

    // Get all migration files in order
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort((a, b) => {
        if (a === 'init.sql') return -1;
        if (b === 'init.sql') return 1;
        return a.localeCompare(b);
      }); // Ensure init.sql runs first

    const pendingMigrations = migrationFiles.filter(file => !appliedMigrations.has(file));
    console.log(`[SQLite] Running ${pendingMigrations.length} migrations...`);

    // Run each migration file
    for (const migrationFile of pendingMigrations) {
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      try {
        // Execute the full migration file at once.
        // This supports multi-statement constructs like triggers.
        this.db.exec(migrationSQL);
        this.db.prepare(`
          INSERT INTO schema_migrations (name, applied_at)
          VALUES (?, ?)
        `).run(migrationFile, new Date().toISOString());
      } catch (error) {
        console.error(`[SQLite] Error in ${migrationFile}:`, error);
        throw error;
      }

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

    const row = stmt.get(conversationId) as ConversationRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      model_used: row.model_used ?? undefined,
      total_tokens: row.total_tokens,
      summary: row.summary ?? undefined,
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

    const rows = stmt.all(limit, offset) as ConversationRow[];
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
      model_used: row.model_used ?? undefined,
      total_tokens: row.total_tokens,
      summary: row.summary ?? undefined,
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
      (id, conversation_id, role, content, created_at, tokens_used, tool_calls, tool_results, model_used, temperature, code_identifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      message.temperature || null,
      message.code_identifiers ? JSON.stringify(message.code_identifiers) : null
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

    const row = stmt.get(messageId) as MessageRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used ?? undefined,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used ?? undefined,
      temperature: row.temperature ?? undefined,
      code_identifiers: row.code_identifiers ? JSON.parse(row.code_identifiers) : undefined,
    };
  }

  /**
   * READ: Get all messages in a conversation
   */
  getConversationMessages(
    conversationId: string,
    options?: { limit?: number; order?: 'asc' | 'desc' }
  ): Message[] {
    const order = options?.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const limitClause = options?.limit ? ` LIMIT ${options.limit}` : '';
    const stmt = this.db.prepare(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ${order}
      ${limitClause}
    `);

    const rows = stmt.all(conversationId) as MessageRow[];
    return rows.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used ?? undefined,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used ?? undefined,
      temperature: row.temperature ?? undefined,
      code_identifiers: row.code_identifiers ? JSON.parse(row.code_identifiers) : undefined,
    }));
  }

  /**
   * READ: Get messages by IDs in a single query
   */
  getMessagesByIds(messageIds: string[]): Message[] {
    if (messageIds.length === 0) return [];

    const placeholders = messageIds.map(() => '?').join(', ');
    const stmt = this.db.prepare(`
      SELECT * FROM messages WHERE id IN (${placeholders})
    `);

    const rows = stmt.all(...messageIds) as MessageRow[];
    return rows.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used ?? undefined,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used ?? undefined,
      temperature: row.temperature ?? undefined,
      code_identifiers: row.code_identifiers ? JSON.parse(row.code_identifiers) : undefined,
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
    const params: string[] = [conversationId];

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
    const rows = stmt.all(...params) as MessageRow[];

    return rows.map(row => ({
      id: row.id,
      conversation_id: row.conversation_id,
      role: row.role,
      content: row.content,
      created_at: row.created_at,
      tokens_used: row.tokens_used ?? undefined,
      tool_calls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      tool_results: row.tool_results ? JSON.parse(row.tool_results) : undefined,
      model_used: row.model_used ?? undefined,
      temperature: row.temperature ?? undefined,
    }));
  }

  /**
   * READ: Get count of messages in a conversation (for summary frequency)
   */
  getConversationMessageCount(conversationId: string, role?: 'user' | 'assistant'): number {
    let query = `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`;
    const params: string[] = [conversationId];

    if (role) {
      query += ` AND role = ?`;
      params.push(role);
    }

    const stmt = this.db.prepare(query);
    const row = stmt.get(...params) as CountRow | undefined;
    return row?.count ?? 0;
  }

  /**
   * CHUNKING: Replace all chunks for a message
   */
  replaceMessageChunks(
    parentMessageId: string,
    chunks: Array<Omit<MessageChunk, 'created_at'>>
  ): MessageChunk[] {
    const deleteStmt = this.db.prepare(`
      DELETE FROM message_chunks WHERE parent_message_id = ?
    `);
    const insertStmt = this.db.prepare(`
      INSERT INTO message_chunks
      (id, parent_message_id, conversation_id, chunk_index, chunk_kind, content, language, token_estimate, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((messageId: string, nextChunks: Array<Omit<MessageChunk, 'created_at'>>) => {
      deleteStmt.run(messageId);
      const now = new Date().toISOString();
      for (const chunk of nextChunks) {
        insertStmt.run(
          chunk.id,
          chunk.parent_message_id,
          chunk.conversation_id,
          chunk.chunk_index,
          chunk.chunk_kind,
          chunk.content,
          chunk.language || null,
          chunk.token_estimate,
          now
        );
      }
    });

    tx(parentMessageId, chunks);
    return this.getMessageChunks(parentMessageId);
  }

  /**
   * CHUNKING: Read all chunks for a parent message
   */
  getMessageChunks(parentMessageId: string): MessageChunk[] {
    const stmt = this.db.prepare(`
      SELECT * FROM message_chunks
      WHERE parent_message_id = ?
      ORDER BY chunk_index ASC
    `);
    const rows = stmt.all(parentMessageId) as MessageChunkRow[];
    return rows.map(row => ({
      id: row.id,
      parent_message_id: row.parent_message_id,
      conversation_id: row.conversation_id,
      chunk_index: row.chunk_index,
      chunk_kind: row.chunk_kind,
      content: row.content,
      language: row.language ?? undefined,
      token_estimate: row.token_estimate,
      created_at: row.created_at,
    }));
  }

  /**
   * UPDATE: Update conversation
   */
  updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const now = new Date().toISOString();
    const setClauses: string[] = ['updated_at = ?'];
    const values: Array<string | number | null> = [now];

    if ('title' in updates) {
      setClauses.push('title = ?');
      values.push(updates.title ?? null);
    }

    if ('model_used' in updates) {
      setClauses.push('model_used = ?');
      values.push(updates.model_used ?? null);
    }

    if ('total_tokens' in updates) {
      setClauses.push('total_tokens = ?');
      values.push(updates.total_tokens ?? null);
    }

    if ('summary' in updates) {
      setClauses.push('summary = ?');
      values.push(updates.summary ?? null);
    }

    if ('tags' in updates) {
      setClauses.push('tags = ?');
      if (Array.isArray(updates.tags)) {
        values.push(JSON.stringify(updates.tags));
      } else {
        values.push(null);
      }
    }

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
    const row = stmt.get(key) as UserPreferenceRow | undefined;

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
  getAllPreferences(): Record<string, PreferenceValue> {
    const stmt = this.db.prepare(`SELECT * FROM user_preferences`);
    const rows = stmt.all() as UserPreferenceRow[];

    const result: Record<string, PreferenceValue> = {};
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
    const row = stmt.get(conversationId) as ConversationSummaryRow | undefined;
    if (!row) return null;

    return {
      conversation_id: row.conversation_id,
      summary: row.summary,
      updated_at: row.updated_at,
      content_hash: row.content_hash ?? undefined,
      embedding_status: row.embedding_status,
      error_message: row.error_message ?? undefined,
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
   * SUMMARY: Record summary state transition and update per-conversation health
   */
  recordSummaryState(
    conversationId: string,
    state: SummaryJobState,
    options?: {
      attempt?: number;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
      countAsRetry?: boolean;
      countAsFailure?: boolean;
    }
  ): void {
    const now = new Date().toISOString();
    const attempt = Number.isFinite(options?.attempt)
      ? Math.max(1, Number(options?.attempt))
      : 1;
    const errorMessage = options?.errorMessage || null;
    const metadata = options?.metadata ? JSON.stringify(options.metadata) : null;
    const retryIncrement = options?.countAsRetry ? 1 : 0;
    const failureIncrement = options?.countAsFailure === false ? 0 : 1;

    this.db.prepare(`
      INSERT OR IGNORE INTO summary_health (conversation_id, last_state, updated_at)
      VALUES (?, 'queued', ?)
    `).run(conversationId, now);

    this.db.prepare(`
      INSERT INTO summary_events (id, conversation_id, state, attempt, error_message, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(this.generateId('sumevt'), conversationId, state, attempt, errorMessage, metadata, now);

    if (state === 'running') {
      this.db.prepare(`
        UPDATE summary_health
        SET
          last_state = 'running',
          last_run_at = ?,
          total_runs = total_runs + 1,
          updated_at = ?
        WHERE conversation_id = ?
      `).run(now, now, conversationId);
      return;
    }

    if (state === 'succeeded') {
      this.db.prepare(`
        UPDATE summary_health
        SET
          last_state = 'succeeded',
          last_success_at = ?,
          last_error = NULL,
          consecutive_failures = 0,
          total_successes = total_successes + 1,
          updated_at = ?
        WHERE conversation_id = ?
      `).run(now, now, conversationId);
      return;
    }

    if (state === 'failed') {
      this.db.prepare(`
        UPDATE summary_health
        SET
          last_state = 'failed',
          last_error = ?,
          consecutive_failures = CASE
            WHEN ? = 1 THEN consecutive_failures + 1
            ELSE consecutive_failures
          END,
          total_failures = total_failures + ?,
          total_retries = total_retries + ?,
          updated_at = ?
        WHERE conversation_id = ?
      `).run(errorMessage, failureIncrement, failureIncrement, retryIncrement, now, conversationId);
      return;
    }

    if (state === 'skipped_no_consent') {
      this.db.prepare(`
        UPDATE summary_health
        SET
          last_state = 'skipped_no_consent',
          last_error = ?,
          updated_at = ?
        WHERE conversation_id = ?
      `).run(errorMessage, now, conversationId);
      return;
    }

    // queued
    this.db.prepare(`
      UPDATE summary_health
      SET
        last_state = 'queued',
        updated_at = ?
      WHERE conversation_id = ?
    `).run(now, conversationId);
  }

  /**
   * SUMMARY: Read per-conversation summary health
   */
  getSummaryHealth(conversationId: string): SummaryHealthRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM summary_health WHERE conversation_id = ?
    `).get(conversationId) as SummaryHealthRow | undefined;

    if (!row) return null;

    return {
      conversation_id: row.conversation_id,
      last_state: row.last_state,
      last_run_at: row.last_run_at ?? undefined,
      last_success_at: row.last_success_at ?? undefined,
      last_error: row.last_error ?? undefined,
      consecutive_failures: row.consecutive_failures,
      total_runs: row.total_runs,
      total_successes: row.total_successes,
      total_failures: row.total_failures,
      total_retries: row.total_retries,
      updated_at: row.updated_at,
    };
  }

  /**
   * SUMMARY: Read recent summary events for observability
   */
  getSummaryEvents(limit: number = 20, conversationId?: string): SummaryEventRecord[] {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, limit)) : 20;
    const rows = conversationId
      ? this.db.prepare(`
          SELECT * FROM summary_events
          WHERE conversation_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).all(conversationId, normalizedLimit) as SummaryEventRow[]
      : this.db.prepare(`
          SELECT * FROM summary_events
          ORDER BY created_at DESC
          LIMIT ?
        `).all(normalizedLimit) as SummaryEventRow[];

    return rows.map(row => {
      let parsedMetadata: Record<string, unknown> | undefined;
      if (row.metadata) {
        try {
          parsedMetadata = JSON.parse(row.metadata) as Record<string, unknown>;
        } catch {
          parsedMetadata = undefined;
        }
      }

      return {
        id: row.id,
        conversation_id: row.conversation_id,
        state: row.state,
        attempt: row.attempt,
        error_message: row.error_message ?? undefined,
        metadata: parsedMetadata,
        created_at: row.created_at,
      };
    });
  }

  /**
   * SUMMARY: Aggregate summary reliability snapshot
   */
  getSummaryHealthSnapshot(windowHours: number = 24): SummaryHealthSnapshot {
    const now = new Date();
    const windowStart = new Date(now.getTime() - Math.max(1, windowHours) * 60 * 60 * 1000);

    const totals = this.db.prepare(`
      SELECT
        COUNT(*) as tracked_conversations,
        COALESCE(SUM(total_runs), 0) as total_runs,
        COALESCE(SUM(total_successes), 0) as total_successes,
        COALESCE(SUM(total_failures), 0) as total_failures,
        COALESCE(SUM(total_retries), 0) as total_retries
      FROM summary_health
    `).get() as {
      tracked_conversations: number;
      total_runs: number;
      total_successes: number;
      total_failures: number;
      total_retries: number;
    };

    const recent = this.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN state = 'running' THEN 1 ELSE 0 END), 0) as runs,
        COALESCE(SUM(CASE WHEN state = 'succeeded' THEN 1 ELSE 0 END), 0) as successes,
        COALESCE(SUM(CASE WHEN state = 'failed' THEN 1 ELSE 0 END), 0) as failures,
        COALESCE(SUM(CASE WHEN state = 'skipped_no_consent' THEN 1 ELSE 0 END), 0) as skipped_no_consent
      FROM summary_events
      WHERE created_at >= ?
    `).get(windowStart.toISOString()) as {
      runs: number;
      successes: number;
      failures: number;
      skipped_no_consent: number;
    };

    const totalRuns = totals.total_runs || 0;
    const totalSuccesses = totals.total_successes || 0;
    const totalFailures = totals.total_failures || 0;
    const recentRuns = recent.runs || 0;
    const recentSuccesses = recent.successes || 0;
    const recentFailures = recent.failures || 0;

    return {
      timestamp: now.toISOString(),
      tracked_conversations: totals.tracked_conversations || 0,
      total_runs: totalRuns,
      total_successes: totalSuccesses,
      total_failures: totalFailures,
      total_retries: totals.total_retries || 0,
      success_rate: totalRuns > 0 ? totalSuccesses / totalRuns : 0,
      failure_rate: totalRuns > 0 ? totalFailures / totalRuns : 0,
      last_24h: {
        runs: recentRuns,
        successes: recentSuccesses,
        failures: recentFailures,
        skipped_no_consent: recent.skipped_no_consent || 0,
        success_rate: recentRuns > 0 ? recentSuccesses / recentRuns : 0,
        failure_rate: recentRuns > 0 ? recentFailures / recentRuns : 0,
      },
    };
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
    const row = stmt.get() as UserProfileRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      profile: row.profile,
      updated_at: row.updated_at,
      content_hash: row.content_hash ?? undefined,
      embedding_status: row.embedding_status,
      error_message: row.error_message ?? undefined,
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

    const rows = stmt.all(limit) as EmbeddingMetadataRow[];
    return rows.map(row => ({
      id: row.id,
      message_id: row.message_id,
      conversation_id: row.conversation_id,
      chroma_id: row.chroma_id ?? undefined,
      created_at: row.created_at,
      embedding_status: row.embedding_status,
      error_message: row.error_message ?? undefined,
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
    const row = stmt.get(sessionId) as SessionRow | undefined;

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
      this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as CountRow
    ).count;

    const messageCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as CountRow
    ).count;

    const pendingCount = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM embedding_metadata WHERE embedding_status = ?')
        .get('pending') as CountRow
    ).count;

    const totalTokens = (
      this.db.prepare('SELECT SUM(tokens_used) as total FROM messages').get() as SumRow
    ).total ?? 0;

    const oldestMsg = (
      this.db
        .prepare('SELECT created_at FROM messages ORDER BY created_at ASC LIMIT 1')
        .get() as CreatedAtRow | undefined
    )?.created_at ?? null;

    const newestMsg = (
      this.db
        .prepare('SELECT created_at FROM messages ORDER BY created_at DESC LIMIT 1')
        .get() as CreatedAtRow | undefined
    )?.created_at ?? null;

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

    const row = stmt.get(strategyName) as StrategyPerformanceRow | undefined;

    if (!row || row.total_decisions === 0) return null;

    return {
      total_decisions: row.total_decisions,
      avg_response_time: Math.round(row.avg_response_time ?? 0),
      avg_tokens_used: Math.round(row.avg_tokens_used ?? 0),
      success_rate: row.success_rate ?? 0,
      avg_quality: row.avg_quality ?? 0
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

    const row = stmt.get(modelName) as ModelPerformanceRow | undefined;

    if (!row || row.total_usage === 0) return null;

    return {
      total_usage: row.total_usage,
      avg_response_time: Math.round(row.avg_response_time ?? 0),
      avg_tokens_used: Math.round(row.avg_tokens_used ?? 0),
      success_rate: row.success_rate ?? 0,
      avg_quality: row.avg_quality ?? 0
    };
  }

  /**
   * STRATEGY ANALYTICS: Get recent strategy decisions
   */
  getRecentStrategyDecisions(limit: number = 10): StrategyDecisionRow[] {
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

    return stmt.all(limit) as StrategyDecisionRow[];
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
