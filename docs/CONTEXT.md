# Context-Aware Memory Upgrade Plan

This document turns the proposed memory improvements into a clear, reviewable plan. It does **not** change runtime behavior yet.

## Goals

- Improve relevance and context-awareness without breaking the existing memory flow.
- Preserve privacy (local, single-user) and explicit consent for long-term profile memory.
- Make changes incremental and reversible via feature flags.

## Baseline (Current State)

**Flow (today):**
- `saveMessage` → async embed → Chroma vector search → memory block appended to system prompt.
- Retrieval is dense-only and scoped to conversation first (then global fallback).
- Memory context is appended (domain prompt is preserved).
- Summary/profile tables exist and embeddings can be stored.

**Key files:**
- Memory core: `app/lib/memory/index.ts`
- RAG: `app/lib/memory/rag/index.ts`, `app/lib/memory/rag/retrieval.ts`
- Storage: `app/lib/memory/storage/sqlite.ts`
- API: `app/api/llm/route.ts`, `app/api/memory/consent/route.ts`

## Implementation Plan (No Behavior Change Yet)

### 1) Baseline Audit + Diagnostics (Safe)

**Purpose:** Measure before changing behavior.

**Actions:**
- Add retrieval composition logs: count of results from:
  - convo-scoped dense
  - global dense
  - conversation summaries
  - profile
- Record retrieval latency + top similarity.
- Add feature-flag plumbing:
  - `RAG_HYBRID` (off by default)
  - `RAG_CHUNKING` (off by default)
  - `RAG_TOKEN_BUDGET` (default unchanged)

**Risk:** Minimal (read-only logging).

---

### 2) Hierarchical Memory (Summaries + Profile)

**Purpose:** Provide distilled context and long-term preferences without noise.

**Already Implemented (ready to use):**
- Tables:
  - `conversation_summaries`
  - `user_profile`
- Consent gate:
  - `memory_profile_consent` in SQLite preferences.
  - API: `/api/memory/consent`.
- Retrieval includes `content_type` for summaries/profile.

**Remaining work:**
- Decide how summaries are created:
  - Manual (UI trigger or API).
  - Automatic (after each assistant reply).
- Decide how profile updates are authored:
  - Manual text entry (explicit).
  - Derived from a UI form.

**Privacy:**
- Profile used only if consent = true.
- Revoking consent clears profile + embeddings.

---

### 3) Hybrid Retrieval + Lightweight Rerank

**Purpose:** Improve recall for exact terms (identifiers, file names, code symbols).

**Additions:**
- SQLite FTS (BM25) index for messages and later chunks.
- Parallel retrieval:
  - Dense (Chroma)
  - Lexical (FTS/BM25)
- Rerank:
  - score = `α * dense_sim + β * bm25_norm + γ * code_id_match`
  - de-dup by message/chunk id

**Rollout:**
- Guard with `RAG_HYBRID=true`.
- Measure latency + relevance.

**Risk:** Moderate (new index + scoring), but contained by flag.

---

### 4) Chunking + Token Budgeting

**Purpose:** Prevent truncation from hiding relevant content.

**Chunking Strategy:**
- Split messages into:
  - code blocks
  - prose sections
- Store chunk metadata:
  - `content_type=message_chunk`
  - `parent_message_id`
  - `chunk_kind=code|prose`
  - `chunk_index`

**Prompt Assembly:**
- Prefer code chunks when code terms appear in the query.
- Enforce `RAG_TOKEN_BUDGET` (e.g., 800–1200 tokens).

**Rollout:**
- Guard with `RAG_CHUNKING=true`.
- Keep original message embeddings for fallback.

**Risk:** Moderate (new storage + prompt assembly logic).

---

### 5) Hardening + Documentation

**Actions:**
- Migrations for FTS + chunk tables.
- Fallback paths if FTS is missing or fails.
- Update `TOOLBAR.md` and memory docs.
- Add a manual test checklist.

---

## Open Decisions (Before Coding)

1) **Summary trigger**: manual vs automatic?
2) **Token budget**: preferred default?
3) **Feature flags**: env only or user preference?

## Acceptance Criteria

- No regressions in chat flow.
- Memory retrieval still works when all new flags are off.
- Consent is respected (profile never used without opt-in).
- Rerank and chunking improve retrieval quality without large latency spikes.

---

# Expanded Implementation Strategy

This section provides critical details to ensure robust implementation without missing edge cases.

## Detailed Implementation Specifications

### 1) Baseline Audit + Diagnostics - Expanded

#### Logging Schema

Add structured logging to `app/lib/memory/rag/retrieval.ts`:

```typescript
interface RetrievalMetrics {
  query: string;
  timestamp: number;
  conversationId: string;
  sources: {
    conversationDense: number;    // Count of results
    globalDense: number;
    summaries: number;
    profile: number;
    ftsLexical?: number;          // When RAG_HYBRID=true
  };
  latency: {
    totalMs: number;
    denseMs: number;
    ftsMs?: number;               // When RAG_HYBRID=true
    rerankMs?: number;
  };
  topSimilarities: number[];      // Top 3 scores
  flags: {
    hybrid: boolean;
    chunking: boolean;
    tokenBudget: number;
  };
}
```

**Storage:** Write to `retrieval_metrics` table (rolling 30-day retention) or log file.

**Dashboard:** Expose metrics via `/api/memory/metrics` for analytics page.

#### Feature Flag Implementation

**Environment Variables (.env.local):**
```bash
RAG_HYBRID=false              # Enable hybrid dense+lexical retrieval
RAG_CHUNKING=false            # Enable message chunking
RAG_TOKEN_BUDGET=1000         # Max tokens for memory context
RAG_SUMMARY_FREQUENCY=5       # Summarize every N messages
RAG_RERANK_ALPHA=0.6          # Dense similarity weight
RAG_RERANK_BETA=0.3           # BM25 weight
RAG_RERANK_GAMMA=0.1          # Code identifier match weight
```

**User Preferences Override (future):**
Add to `LeftToolbar.tsx` settings after validation in production.

---

### 2) Hierarchical Memory - Concrete Decisions

#### Summary Generation Strategy

**Decision: Automatic with Frequency Control**

- **Trigger:** After every `RAG_SUMMARY_FREQUENCY` (default: 5) assistant messages
- **Content:** Distill conversation progress, key decisions, user preferences discovered
- **Privacy:** Only summarize user+assistant messages, exclude system prompts
- **Storage:** `conversation_summaries` table with embedding

**Implementation:**
```typescript
// In app/lib/memory/index.ts saveMessage()
if (message.role === 'assistant') {
  const messageCount = await getConversationMessageCount(conversationId);
  const frequency = parseInt(process.env.RAG_SUMMARY_FREQUENCY || '5');

  if (messageCount % frequency === 0) {
    await generateConversationSummary(conversationId);
  }
}
```

**Summary Prompt Template:**
```
Summarize the last {N} messages in this conversation. Focus on:
- Key technical decisions made
- User preferences or constraints mentioned
- Important context for future messages
- Avoid repeating code verbatim

Format as concise bullet points (max 200 tokens).
```

#### Profile Updates Strategy

**Decision: Manual Text Entry + Structured Fields**

**UI Location:** Add "Memory Profile" section to settings or analytics page

**Profile Schema:**
```typescript
interface UserProfile {
  id: string;
  preferences: {
    codingStyle?: string;        // "functional", "OOP", etc.
    preferredLanguages?: string[];
    frameworkExperience?: string[];
  };
  context: {
    projectGoals?: string;
    domain?: string;              // "web dev", "ML", etc.
    constraints?: string;         // "no dependencies", etc.
  };
  freeformNotes: string;          // User-editable long-form text
  updatedAt: number;
}
```

**Update Trigger:**
- Manual button: "Update My Profile"
- Form fields for structured data
- Textarea for freeform notes
- Auto-embed on save

**Privacy Enforcement:**
```typescript
// In app/lib/memory/rag/retrieval.ts
async function retrieveMemory(query: string, conversationId: string) {
  const consent = await getMemoryConsent();

  const sources = {
    conversation: await searchConversation(conversationId, query),
    summaries: await searchSummaries(conversationId, query),
    global: await searchGlobal(query),
  };

  // ONLY include profile if consent=true
  if (consent) {
    sources.profile = await searchProfile(query);
  }

  return combineAndRank(sources);
}
```

---

### 3) Hybrid Retrieval - Full Specification

#### FTS Index Schema

**Table: `messages_fts`**
```sql
CREATE VIRTUAL TABLE messages_fts USING fts5(
  message_id UNINDEXED,
  conversation_id UNINDEXED,
  content,
  role UNINDEXED,
  tokenize='porter unicode61'
);

CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages
BEGIN
  INSERT INTO messages_fts(message_id, conversation_id, content, role)
  VALUES (new.id, new.conversation_id, new.content, new.role);
END;
```

**Index Scope:**
- User and assistant messages only (exclude system prompts for privacy)
- All conversations (enable cross-conversation keyword search)
- Estimated size: ~30% of message content size (test with 10k messages)

#### Parallel Retrieval Flow

```typescript
async function hybridRetrieval(query: string, conversationId: string, limit: number = 10) {
  const [denseResults, ftsResults] = await Promise.all([
    chromaSearch(query, conversationId, limit * 2),  // Over-fetch for reranking
    ftsSearch(query, conversationId, limit * 2),
  ]);

  // Merge and rerank
  const combined = deduplicateAndRerank(denseResults, ftsResults, query);

  return combined.slice(0, limit);
}
```

#### Reranking Algorithm

**Score Formula:**
```
final_score = α·dense_sim + β·bm25_norm + γ·code_match

Where:
- dense_sim: Cosine similarity from Chroma (0-1)
- bm25_norm: BM25 score normalized to 0-1
- code_match: 1 if query contains code identifiers found in result, else 0
```

**Default Coefficients:**
- α (dense weight) = 0.6
- β (BM25 weight) = 0.3
- γ (code match weight) = 0.1

**Code Identifier Detection:**
```typescript
function extractCodeIdentifiers(text: string): Set<string> {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const inlineCodeRegex = /`([^`]+)`/g;
  const camelCaseRegex = /\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  const functionCallRegex = /\b\w+\(/g;

  const identifiers = new Set<string>();
  // Extract from code blocks, inline code, camelCase, function calls
  // ... implementation
  return identifiers;
}
```

**Tuning Strategy:**
1. Create labeled test set (20-30 queries with relevance scores)
2. Grid search over α, β, γ values
3. Optimize for NDCG@5 (Normalized Discounted Cumulative Gain)
4. Document final coefficients in `.env`

**Deduplication:**
```typescript
function deduplicateAndRerank(dense: Result[], fts: Result[], query: string): Result[] {
  const seen = new Set<string>();
  const merged: Result[] = [];

  // Combine sources
  for (const result of [...dense, ...fts]) {
    const key = result.messageId || result.chunkId;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(result);
    }
  }

  // Rerank
  const queryIdentifiers = extractCodeIdentifiers(query);

  return merged
    .map(r => ({
      ...r,
      finalScore: calculateFinalScore(r, queryIdentifiers),
    }))
    .sort((a, b) => b.finalScore - a.finalScore);
}
```

---

### 4) Chunking - Complete Strategy

#### Chunking Algorithm

**Split Rules:**
1. Extract all code blocks (triple backticks)
2. Split remaining prose on paragraph boundaries (double newline)
3. Enforce max chunk size: 500 tokens (prevents over-splitting)

**Schema:**
```sql
CREATE TABLE message_chunks (
  id TEXT PRIMARY KEY,
  parent_message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_kind TEXT CHECK(chunk_kind IN ('code', 'prose')),
  content TEXT NOT NULL,
  token_count INTEGER,
  language TEXT,  -- For code chunks: 'typescript', 'python', etc.
  created_at INTEGER NOT NULL,
  FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_parent ON message_chunks(parent_message_id);
CREATE INDEX idx_chunks_conversation ON message_chunks(conversation_id);
```

**Embedding Strategy:**
- Generate embeddings for chunks AND full messages
- Chunks enable fine-grained retrieval
- Full messages provide fallback when chunking is disabled

**Migration Plan:**
```typescript
// migration_20260118_add_chunking.ts
async function up(db: Database) {
  await db.exec(`
    CREATE TABLE message_chunks (...);
    CREATE VIRTUAL TABLE chunks_fts USING fts5(...);
  `);

  // Backfill existing messages (optional, controlled by flag)
  if (process.env.BACKFILL_CHUNKS === 'true') {
    const messages = await db.all('SELECT * FROM messages');
    for (const msg of messages) {
      await chunkAndStoreMessage(msg);
    }
  }
}
```

**Backfill Strategy:**
- Default: Chunk only NEW messages (forward-only)
- Optional: Set `BACKFILL_CHUNKS=true` to process historical messages
- Progress tracking: Store last backfilled message ID

#### Token Budget Enforcement

**Implementation:**
```typescript
async function assembleMemoryContext(
  query: string,
  conversationId: string,
  budget: number = parseInt(process.env.RAG_TOKEN_BUDGET || '1000')
): Promise<string> {
  const results = await retrieveMemory(query, conversationId);
  const chunks: string[] = [];
  let tokenCount = 0;

  // Prioritize code chunks for code-heavy queries
  const isCodeQuery = /[A-Z][a-z]+[A-Z]|function|class|const|import/.test(query);
  const sorted = isCodeQuery
    ? [...results].sort((a, b) => (b.kind === 'code' ? 1 : -1))
    : results;

  for (const result of sorted) {
    const tokens = estimateTokens(result.content);
    if (tokenCount + tokens > budget) break;

    chunks.push(result.content);
    tokenCount += tokens;
  }

  return chunks.join('\n\n---\n\n');
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
```

**Overflow Handling:**
- If budget exceeded, truncate at chunk boundary (don't split chunks)
- Log overflow events for budget tuning
- Prioritize recent + high-relevance results

---

### 5) Hardening - Comprehensive Approach

#### Error Handling & Fallbacks

**FTS Fallback:**
```typescript
async function ftsSearch(query: string, conversationId: string) {
  try {
    return await db.all(`
      SELECT * FROM messages_fts WHERE content MATCH ? AND conversation_id = ?
    `, [query, conversationId]);
  } catch (error) {
    if (error.message.includes('no such table')) {
      console.warn('[Memory] FTS not available, falling back to dense-only');
      return [];
    }
    throw error;
  }
}
```

**Embedding Service Outage:**
```typescript
async function saveMessage(message: Message) {
  try {
    const embedding = await generateEmbedding(message.content);
    await storeWithEmbedding(message, embedding);
  } catch (error) {
    console.error('[Memory] Embedding failed, storing without vector:', error);
    await storeWithoutEmbedding(message);
    // Retry embedding in background job
    queueEmbeddingRetry(message.id);
  }
}
```

**Consent Revocation:**
```typescript
async function revokeMemoryConsent() {
  await db.transaction(async (tx) => {
    // Clear profile
    await tx.run('DELETE FROM user_profile');

    // Clear profile embeddings from Chroma
    await chromaClient.deleteCollection('user_profile');

    // Update preference
    await tx.run(
      'UPDATE preferences SET value = ? WHERE key = ?',
      ['false', 'memory_profile_consent']
    );
  });
}
```

#### Testing Strategy

**Automated Integration Tests:**
```typescript
describe('Memory Retrieval', () => {
  test('respects consent for profile', async () => {
    await setConsent(false);
    const results = await retrieveMemory('test query', 'conv-1');
    expect(results.some(r => r.contentType === 'profile')).toBe(false);
  });

  test('hybrid retrieval improves code recall', async () => {
    await seedMessages([
      { content: 'function calculateTotal() { ... }' },
      { content: 'The total is calculated by summing values' },
    ]);

    const results = await retrieveMemory('calculateTotal', 'conv-1');
    expect(results[0].content).toContain('function calculateTotal');
  });

  test('chunking prevents context truncation', async () => {
    const longMessage = generateLongMessage(2000); // tokens
    await saveMessage(longMessage);

    const context = await assembleMemoryContext('find function', 'conv-1');
    expect(context).toContain('function targetFunction');
  });
});
```

**Performance Regression Tests:**
```typescript
test('retrieval latency under 200ms (p95)', async () => {
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const start = Date.now();
    await retrieveMemory('test query', 'conv-1');
    samples.push(Date.now() - start);
  }

  const p95 = percentile(samples, 95);
  expect(p95).toBeLessThan(200);
});
```

**Manual Test Checklist:**
- [ ] Memory toggle in LeftToolbar persists across sessions
- [ ] Consent revocation clears profile from UI and database
- [ ] Hybrid retrieval returns code identifiers accurately
- [ ] Chunking preserves context for long messages (>1000 tokens)
- [ ] Feature flags can be toggled without restart
- [ ] Summaries generate every N messages when enabled
- [ ] Analytics page displays retrieval metrics

---

## Edge Cases & Boundary Conditions

### Cold Start Scenarios

**New User (No History):**
- No messages → retrieval returns empty array
- No profile → profile section omitted from context
- No summaries → conversation-only retrieval

**Graceful Degradation:**
```typescript
async function assembleMemoryContext(query: string, conversationId: string) {
  const results = await retrieveMemory(query, conversationId);

  if (results.length === 0) {
    return ''; // Empty memory context, LLM proceeds with prompt only
  }

  return formatMemoryContext(results);
}
```

### Conversation Boundaries

**Cross-Conversation Retrieval:**
- Conversation-scoped search FIRST (higher relevance)
- Global fallback if <3 results from current conversation
- Summaries are conversation-scoped (never cross boundaries)

**Conversation Deletion:**
```sql
-- Cascade deletes via foreign keys
DELETE FROM conversations WHERE id = ?;
-- Also deletes: messages, message_chunks, conversation_summaries, embeddings
```

### Resource Limits

**Database Growth:**
- Message table: ~1KB per message → 100k messages = 100MB
- Embeddings (Chroma): ~1536 floats × 4 bytes = 6KB per embedding → 100k = 600MB
- FTS index: ~30% overhead → 30MB
- **Total for 100k messages: ~730MB** (acceptable for local app)

**Chroma Collection Limits:**
- Current implementation: single collection per conversation
- Scale plan: Shard by conversation or date range if >1M messages

### Index Maintenance

**FTS Index Rebuild:**
```sql
-- If index corruption detected
DROP TABLE messages_fts;
CREATE VIRTUAL TABLE messages_fts USING fts5(...);
INSERT INTO messages_fts SELECT id, conversation_id, content, role FROM messages;
```

**Embedding Refresh:**
- If embedding model changes, re-embed all messages
- Use background job with progress tracking
- Keep old embeddings until new ones are ready (zero-downtime migration)

---

## Monitoring & Observability

### Key Metrics

**Retrieval Quality:**
- Hit rate: % of queries returning >0 results
- Average similarity score of top result
- Distribution of content types (message, chunk, summary, profile)

**Performance:**
- p50, p95, p99 latency for retrieval
- Embedding generation time
- FTS query time vs dense query time

**Usage:**
- Feature flag adoption (% of queries with each flag enabled)
- Token budget utilization (avg tokens used / budget)
- Summary generation frequency

### Debug Endpoints

**GET /api/memory/debug/retrieval**
```typescript
// Query: ?q=test&conversationId=123
{
  query: "test",
  results: [
    { content: "...", score: 0.85, source: "dense", type: "message" },
    { content: "...", score: 0.72, source: "fts", type: "chunk" }
  ],
  metrics: {
    totalMs: 145,
    denseMs: 80,
    ftsMs: 60,
    rerankMs: 5
  },
  flags: { hybrid: true, chunking: true, tokenBudget: 1000 }
}
```

**GET /api/memory/debug/stats**
```typescript
{
  totalMessages: 5423,
  totalConversations: 87,
  totalChunks: 2341,
  totalSummaries: 34,
  profileConsent: true,
  indexSizes: {
    messages: "5.2 MB",
    embeddings: "32.1 MB",
    fts: "1.8 MB"
  }
}
```

---

## Rollout Plan

### Phase 1: Baseline (Week 1)
- [ ] Add retrieval metrics logging
- [ ] Implement feature flag system
- [ ] Deploy with all flags OFF
- [ ] Collect 1 week of baseline metrics

### Phase 2: Summaries + Profile (Week 2)
- [ ] Implement automatic summary generation
- [ ] Build profile management UI
- [ ] Test consent enforcement
- [ ] Deploy to production (always on, no flag needed)

### Phase 3: Hybrid Retrieval (Week 3)
- [ ] Create FTS migration
- [ ] Implement parallel retrieval + reranking
- [ ] Deploy with `RAG_HYBRID=true` for power users
- [ ] Monitor latency + quality metrics
- [ ] Tune α, β, γ coefficients

### Phase 4: Chunking (Week 4)
- [ ] Create chunking migration
- [ ] Implement token budget enforcement
- [ ] Deploy with `RAG_CHUNKING=true` for beta testers
- [ ] Measure context quality improvements

### Phase 5: Stabilization (Week 5)
- [ ] Analyze metrics from phases 3-4
- [ ] Set default flags based on performance data
- [ ] Add user-facing settings to LeftToolbar
- [ ] Document final configuration in README

---

## Answers to Open Decisions

### 1) Summary Trigger
**Decision: Automatic every 5 messages**
- Configurable via `RAG_SUMMARY_FREQUENCY` env var
- Opt-out via setting frequency to 0
- Future: Add manual "Summarize Now" button to UI

### 2) Token Budget
**Decision: 1000 tokens default**
- Rationale: Balances context richness with prompt size
- Configurable via `RAG_TOKEN_BUDGET` env var
- Monitor actual usage in baseline phase
- Adjust based on median + p95 usage

### 3) Feature Flags
**Decision: Environment variables initially, user preferences later**
- **Phase 1-4:** Env vars only (`.env.local`)
- **Phase 5:** Promote to user settings in `LeftToolbar.tsx`
- Settings panel layout:
  ```
  Memory Settings:
  ☑ Enable Hybrid Search (improves code recall)
  ☑ Enable Smart Chunking (better long message handling)
  Token Budget: [1000] (recommended: 800-1500)
  Summary Frequency: [5] messages (0 to disable)
  ```

---

## Success Criteria (Measurable)

### Functional Requirements
✅ All existing memory functionality works with flags OFF
✅ Profile never appears in context when consent=false
✅ Summaries generate automatically at configured frequency
✅ Hybrid retrieval includes both dense and FTS results
✅ Chunking preserves code blocks intact
✅ Token budget never exceeded by >5%

### Performance Requirements
✅ Retrieval latency p95 < 200ms (hybrid on)
✅ Embedding generation < 500ms per message
✅ FTS index size < 50% of message table size
✅ Database growth < 1GB per 100k messages

### Quality Requirements
✅ Code identifier recall improves by >20% with hybrid (vs dense-only)
✅ Context truncation reduced by >50% with chunking
✅ User survey: >80% find summaries helpful
✅ Zero privacy violations (audit log shows profile gating works)
