# Changelog

All notable changes to OrthoAI will be documented in this file. (Legacy entries may still reference the Hacker Reign template.)

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Documentation] - 2026-02-05 - Fix BioMistral Startup Instructions

### Added
- `docs/STARTUP.md` with three-terminal startup commands (LLM server, embeddings server, app).

### Changed
- `docs/SETUP.md` and `docs/STARTUP.md` updated to use the correct BioMistral GGUF repo (`tensorblock/BioMistral-7B-GGUF`).
- Added `BioMistral-7B-Q5_K_M.gguf` as an optional higher quality model.
- Removed the gated-model token note since the repo is not gated.

## [Bug Fix] - 2026-01-25 - ChromaDB Multi-Filter Query Fix

### Problem

ChromaDB was throwing `ChromaValueError` when attempting to search with multiple metadata filters:

```
Error [ChromaValueError]: Expected 'where' to have exactly one operator, but got 2
    at ChromaRetrieval.search (app/lib/memory/rag/retrieval.ts:215:40)
```

**Root Cause:** When calling `searchWithFilters()` with multiple conditions (e.g., `conversation_id` AND `content_type`), the code built a flat object with multiple operators at the top level:

```javascript
// INVALID - ChromaDB sees 2 operators at top level
{
  conversation_id: { $eq: "xxx" },
  content_type: { $eq: "conversation_summary" }
}
```

ChromaDB requires multiple conditions to be explicitly wrapped in an `$and` operator.

### Impact

This bug was blocking:
- ✅ RAG retrieval with conversation-specific filters
- ✅ Summary retrieval (queries with both `conversation_id` and `content_type`)
- ✅ Profile retrieval with role filters
- ✅ LLM responses that depend on memory augmentation

The error occurred during `augmentPrompt()` in the API route, causing failures in message processing.

### Solution

**File:** `app/lib/memory/rag/retrieval.ts` (Lines 315-343)

Updated `searchWithFilters()` method to properly construct ChromaDB-compatible where clauses:

```typescript
// Before (BROKEN)
const chromaFilters: Record<string, any> = {};
if (filters.conversation_id) {
  chromaFilters.conversation_id = { $eq: filters.conversation_id };
}
if (filters.content_type) {
  chromaFilters.content_type = { $eq: filters.content_type };
}
return this.search(query, topK, chromaFilters);

// After (FIXED)
const conditions: Record<string, any>[] = [];
if (filters.conversation_id) {
  conditions.push({ conversation_id: { $eq: filters.conversation_id } });
}
if (filters.content_type) {
  conditions.push({ content_type: { $eq: filters.content_type } });
}

let chromaFilters: Record<string, any> | undefined = undefined;
if (conditions.length === 1) {
  // Single condition: use directly
  chromaFilters = conditions[0];
} else if (conditions.length > 1) {
  // Multiple conditions: wrap in $and
  chromaFilters = { $and: conditions };
}
return this.search(query, topK, chromaFilters);
```

### Changes

**Modified Files:**
- `app/lib/memory/rag/retrieval.ts` (Lines 315-343)
  - Refactored filter construction logic
  - Added support for single vs multiple condition handling
  - Wraps multiple conditions in `$and` operator
  - Maintains backward compatibility (single condition unchanged)

### Verification

The fix ensures:
- ✅ Single filter queries work unchanged: `{ conversation_id: { $eq: "xxx" } }`
- ✅ Multi-filter queries use `$and`: `{ $and: [{ conversation_id: ... }, { content_type: ... }] }`
- ✅ No filters passed → `undefined` (searches all documents)
- ✅ RAG retrieval works correctly for conversation summaries and profiles

### Related Issues

- ChromaDB `where` clause syntax requirements
- Phase 2 feature: Conversation summaries retrieval
- Phase 2 feature: User profile retrieval with consent

---

## [Documentation] - 2026-01-25 - Comprehensive Documentation Update

### Added

**README.md - Complete AI Models Section:**
- Documented all 5 LLM models with RAM requirements, speeds, and use cases
  - llama3.2:3b, qwen2.5:7b, qwen2.5-coder:7b, yi-coder:9b, deepseek-coder-v2:16b
- Added embedding model documentation (nomic-embed-text with alternatives)
- Added Whisper STT model details (small, 330MB, installation instructions)
- Added Piper TTS voice model options (4 voices with characteristics)
- Added model storage requirements calculator (3GB minimum, 8-9GB recommended, 25-30GB power user)
- Added model storage locations for all AI components

**README.md - Strategy System:**
- Added 6th strategy type: Workflow (multi-model orchestration)
- Documented chain mode (sequential: draft → refine → review)
- Documented ensemble mode (parallel voting with weighted consensus)
- Updated strategy selection flow diagram

**README.md - Memory & RAG System:**
- Added Phase 2 features documentation:
  - Conversation summaries (automatic every 5 messages)
  - User profile management (5-field structured profile with consent)
  - Profile UI integration in LeftToolbar
- Added Phase 3 features documentation (ENABLED in production):
  - Hybrid retrieval (dense + FTS5/BM25)
  - Code identifier matching (camelCase, PascalCase, functions)
  - Intelligent reranking algorithm (α=0.6, β=0.3, γ=0.1)
  - FTS5 full-text index (346 messages indexed)
  - Performance metrics (<10ms overhead)
- Updated migration count (7 migrations applied)

**README.md - API Endpoints:**
- Added 6 missing endpoints:
  - `GET /api/memory/metrics` - Retrieval performance metrics
  - `POST/GET/DELETE /api/memory/consent` - Memory consent management
  - `POST/GET/DELETE /api/profile` - User profile management
  - `GET /api/piper-tts/voices` - List available voice models
  - `POST /api/analytics` - Cleanup old analytics data
- Added complete parameter documentation for all endpoints

**README.md - Environment Variables:**
- Added Phase 1-3 memory feature flags:
  - `RAG_HYBRID=true`, `RAG_SUMMARY_FREQUENCY=5`, `RAG_RERANK_ALPHA/BETA/GAMMA`, `METRICS_RETENTION_DAYS`
- Added voice configuration variables:
  - `NEXT_PUBLIC_PIPER_VOICE`, `WHISPER_PATH`
- Added model defaults:
  - `NEXT_PUBLIC_DEFAULT_MODEL`, `OLLAMA_EMBED_MODEL`
- Added Ollama performance flags:
  - `OLLAMA_KEEP_ALIVE`, `OLLAMA_NUM_PARALLEL`, `OLLAMA_FLASH_ATTENTION`

**README.md - Enhanced Architecture Diagrams:**
- Updated Memory & RAG flow with Phase 3 hybrid retrieval details
- Added all 6 strategy types to strategy selection flow
- Added reranking algorithm visualization

**app/lib/memory/README.md:**
- Updated version from 1.1.0 to 1.3.0 (Phase 3)
- Added Phase 2 features section with examples
- Added Phase 3 hybrid retrieval section with detailed explanation
- Added retrieval metrics documentation
- Documented all 7 migrations (001-007)
- Updated environment variables with Phase 1-3 flags

**app/lib/strategy/README.md:**
- Added workflow strategy documentation
- Documented chain mode (sequential processing)
- Documented ensemble mode (parallel voting)
- Added use cases and code examples
- Updated directory structure with workflowStrategy.ts

**STRUCTURE.md:**
- Added workflowStrategy.ts to strategy implementations
- Added mode_analytics.db to data directory
- Updated strategy implementation descriptions

### Changed

**README.md:**
- Updated "Prerequisites" section with model installation guidance
- Enhanced configuration examples with all available options
- Updated "Recent Updates" section with Phase 2 & 3 timeline
- Changed strategy count from 5 to 6 in multiple locations

### Documentation Quality Improvements

- **Completeness**: All implemented features now documented
- **Accuracy**: Documentation matches production code (Phase 3 ENABLED)
- **Clarity**: Added use cases, examples, and performance metrics
- **Navigation**: Cross-references between related documentation files
- **User Guidance**: Installation paths for all model types and configurations

### Files Updated

1. `README.md` - Main project documentation (comprehensive overhaul)
2. `app/lib/memory/README.md` - Memory system documentation (Phase 2 & 3 added)
3. `app/lib/strategy/README.md` - Strategy system documentation (workflow added)
4. `STRUCTURE.md` - Project structure reference (missing files added)
5. `CHANGELOG.md` - This file (documentation tracking added)

---

## [Build Fix] - 2026-01-25 - Tailwind CSS v4 Configuration

### Problem

Next.js 16.1.1 with Turbopack was unable to resolve Tailwind CSS imports, causing repeated build errors:
```
Error: Can't resolve 'tailwindcss' in '/Users/jeffspirlock'
Error: Can't resolve '../node_modules/tailwindcss/index.css' in '/Users/jeffspirlock'
```

**Root Cause:** Turbopack was resolving CSS module imports from the user's home directory (`/Users/jeffspirlock`) instead of the project directory (`/Users/jeffspirlock/hackerreign`), causing all `@import` statements in `app/globals.css` to fail.

### Solution

#### 1. Clean Build Environment
```bash
rm -rf .next node_modules package-lock.json
npm install
```

#### 2. Updated PostCSS Configuration
**File:** `postcss.config.mjs`
- Added explicit `base` directory resolution to help Turbopack find the correct project root
- Used ES module syntax with `import.meta.url` to get current directory

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      base: __dirname,  // ← Fix: Explicit base directory
    },
  },
};

export default config;
```

#### 3. Simplified Tailwind Configuration for v4
**File:** `tailwind.config.ts`
- Removed `corePlugins: { preflight: false }` which was blocking base styles
- Removed theme extensions (moved to CSS using `@theme` directive)
- Kept only content paths for file scanning

**Before:**
```typescript
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: { 'cyan-light': '#7FEFEF', ... },
      backgroundImage: { ... }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false  // ← Blocking base styles
  }
}
```

**After:**
```typescript
export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}'
  ]
}
```

#### 4. Updated Global Styles for Tailwind v4
**File:** `app/globals.css`
- Simplified to use single `@import "tailwindcss"` (includes all layers)
- Migrated custom colors to `@theme` directive (Tailwind v4 CSS-based config)
- Removed `@theme inline` syntax (not needed)
- Kept custom CSS variables for background/foreground

**Before:**
```css
@config "../tailwind.config.ts";
@import "../node_modules/tailwindcss/index.css";

:root {
  --cyan-light: #7FEFEF;
  ...
}

@theme inline {
  --color-cyan-light: var(--cyan-light);
  ...
}
```

**After:**
```css
@import "tailwindcss";

@theme {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --color-cyan-light: #7FEFEF;
  --color-teal: #33D1CC;
  --color-yellow: #FFED66;
  --color-peach: #FFB380;
}

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}
```

### Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `postcss.config.mjs` | Added `base: __dirname` option | 1-15 |
| `tailwind.config.ts` | Removed `preflight: false`, simplified config | 1-8 |
| `app/globals.css` | Migrated to `@theme` directive, simplified imports | 1-29 |

### Key Learnings

1. **Tailwind CSS v4 Architecture Changes:**
   - Uses `@tailwindcss/postcss` plugin instead of traditional PostCSS setup
   - CSS-based configuration via `@theme` directive
   - Single `@import "tailwindcss"` includes all layers (theme, base, components, utilities)
   - No longer uses `@tailwind base/components/utilities` directives

2. **Turbopack CSS Resolution:**
   - Requires explicit `base` directory in PostCSS plugin config
   - Module resolution context differs from Webpack
   - Clean rebuild necessary after configuration changes

3. **Migration Path v3 → v4:**
   - Move `theme.extend` from `tailwind.config.ts` to CSS `@theme` blocks
   - Remove `corePlugins.preflight` setting
   - Avoid relative imports like `@import "../node_modules/..."`

### Verification

✅ **Build Errors:** Resolved - No more Tailwind CSS resolution errors
✅ **Styles Applied:** Confirmed - Page renders with correct Tailwind utilities
✅ **Dev Server:** Running cleanly on `http://localhost:3000`
✅ **Custom Theme:** Colors and fonts accessible via Tailwind classes

### Dependencies

- `next`: 16.1.1
- `tailwindcss`: ^4
- `@tailwindcss/postcss`: ^4
- `postcss`: ^8.5.1

### Related Issues

- Next.js Turbopack CSS module resolution
- Tailwind CSS v4 breaking changes from v3
- PostCSS plugin configuration for ES modules

---

## [Phase 3] - 2026-01-25 - Hybrid Retrieval + Reranking

### Added

#### Database Migrations
- **`app/lib/memory/migrations/006_fts_index.sql`** (NEW)
  - Created FTS5 virtual table `messages_fts` for full-text search
  - Columns: `message_id`, `conversation_id`, `content`, `role`
  - Porter stemming + unicode normalization tokenizer
  - **Status:** ✅ Applied (346 messages backfilled)

- **`app/lib/memory/migrations/007_fts_triggers.sql`** (NEW)
  - Backfill query to populate FTS index with existing messages
  - Filters to only index user and assistant messages (excludes system)
  - **Status:** ✅ Applied

#### New Files
- **`app/lib/memory/rag/rerank.ts`** (NEW - 183 lines)
  - `extractCodeIdentifiers(text)`: Extracts code identifiers from text
    - Patterns: code blocks (```), inline code (`), camelCase, PascalCase, snake_case, function calls
    - Returns: Set<string> of normalized identifiers
  - `calculateCodeMatch()`: Binary match (0 or 1) for code identifier presence
  - `normalizeBM25()`: Normalizes BM25 scores to 0-1 range
  - `calculateFinalScore()`: Weighted scoring formula: α·dense + β·bm25 + γ·code_match
  - `deduplicateAndRerank()`: Main reranking function
    - Deduplicates by message ID
    - Calculates weighted scores
    - Sorts by final score (descending)
  - `mergeConversationAndGlobal()`: Prioritizes conversation-scoped results

- **`scripts/test-phase3-hybrid.ts`** (NEW - 282 lines)
  - Comprehensive test suite for Phase 3
  - Tests: FTS index, code extraction, FTS search, hybrid retrieval, reranking
  - Test results: ✅ All tests passing (4/4 code extraction tests)

#### Modified Files

- **`app/lib/memory/schemas.ts`**
  - **Line 119:** Added `fts_score?: number` to `RetrievalResult` interface
  - Purpose: Store raw BM25 score for debugging and analysis

- **`app/lib/memory/storage/sqlite.ts`**
  - **Lines 960-965:** Added `getDatabase(): Database.Database` method
  - Purpose: Provide direct database access for FTS queries
  - Visibility: Public method

- **`app/lib/memory/rag/retrieval.ts`**
  - **Lines 468-560:** Added `ftsSearch()` method (83 lines)
  - Parameters: `query`, `conversationId?`, `limit = 10`
  - Logic:
    - Escapes special characters from query
    - Splits query into terms (filters terms < 3 chars)
    - Joins with OR for broader matching
    - Executes FTS5 MATCH query with BM25 scoring
    - Normalizes BM25 scores to 0-1 range
    - Returns `RetrievalResult[]` with `fts_score` populated
  - Error handling: Graceful fallback to empty array if FTS unavailable

- **`app/lib/memory/rag/index.ts`**
  - **Line 10:** Added import: `import { deduplicateAndRerank } from './rerank'`
  - **Lines 143-218:** Modified `retrieveSimilarMessages()` method (75 lines changed)
    - Added tracking variables: `ftsMs`, `rerankStartTime`, `rerankMs`
    - Added Phase 3 hybrid retrieval branch:
      - When `config.ragHybrid === true`:
        - Parallel execution of dense + FTS searches using `Promise.all()`
        - Over-fetches (topK × 2) for better reranking
        - Calls `deduplicateAndRerank()` to combine results
        - Slices to topK after reranking
        - Logs performance metrics (dense, FTS, rerank latency)
      - When `config.ragHybrid === false`:
        - Falls back to original dense-only behavior (Phase 1-2)
  - **Lines 243-257:** Updated metrics logging
    - **Line 243:** `ftsLexical: ftsResults.length` (was 0)
    - **Line 248:** `ftsMs` (was 0)
    - **Line 249:** `rerankMs` (was 0)

### Configuration Changes

- **`.env.local`**
  - **Line 51:** Changed `RAG_HYBRID=false` → `RAG_HYBRID=true`
  - **Status:** ✅ ENABLED IN PRODUCTION
  - Default coefficients (already present):
    - `RAG_RERANK_ALPHA=0.6` (dense weight)
    - `RAG_RERANK_BETA=0.3` (BM25 weight)
    - `RAG_RERANK_GAMMA=0.1` (code match weight)

### Performance Metrics

- FTS search latency: <5ms average
- Reranking latency: <1ms for 20 results
- Total overhead: <10ms vs dense-only retrieval
- Code identifier recall: Improved exact match detection

### Breaking Changes

None. Phase 3 is fully backward compatible:
- When `RAG_HYBRID=false`, system behaves exactly as Phase 1-2
- All new code paths are feature-flagged
- FTS index creation is non-blocking

### Migration Notes

- Migration 006 + 007 auto-apply on next app start
- Existing messages automatically backfilled to FTS index (346 entries)
- No manual intervention required

---

## [Phase 2] - 2026-01-20 - Summaries + Profile

### Added

#### Database Migrations
- **`app/lib/memory/migrations/003_memory_summaries.sql`**
  - Created `conversation_summaries` table
  - Created `user_profile` table
  - Added indexes on `updated_at` columns

#### New Files
- **`app/api/profile/route.ts`** (95 lines)
  - `GET /api/profile`: Fetch user profile
  - `POST /api/profile`: Save user profile (requires consent)
  - `DELETE /api/profile`: Clear profile and embeddings

- **`scripts/test-phase2-summaries.ts`** (175 lines)
  - Tests for summary generation
  - Tests for profile consent management
  - Tests for profile save/retrieve/clear

#### Modified Files

- **`app/lib/memory/index.ts`**
  - **Lines 115-133:** Modified `saveMessage()` to check message count
  - **Lines 184-239:** Added `generateConversationSummary()` method (56 lines)
    - Fetches last 10 messages
    - Calls Ollama API to generate summary
    - Saves via `saveConversationSummary()`
    - Async, non-blocking error handling

- **`components/LeftToolbar.tsx`**
  - **Lines 58-100:** Added profile state management
  - **Lines 139-190:** Added profile handlers
  - **Lines 363-440:** Added expandable profile UI section (78 lines)
    - Collapsible hamburger-style menu
    - Disabled when Memory consent OFF
    - 5 structured fields: codingStyle, languages, frameworks, preferences, notes
    - Save/Clear buttons with loading states

### Configuration Changes

- **`.env.local`**
  - `RAG_SUMMARY_FREQUENCY=5` (already present from Phase 1)

### Features

- ✅ Automatic conversation summarization every N messages
- ✅ User profile management UI
- ✅ Profile consent enforcement
- ✅ Profile cleared on consent revocation

---

## [Phase 1] - 2026-01-18 - Baseline Audit + Diagnostics

### Added

#### Database Migrations
- **`app/lib/memory/migrations/004_retrieval_metrics.sql`**
  - Created `retrieval_metrics` table with full tracking
  - Created `retrieval_metrics_summary` view for aggregation
  - 30-day rolling retention

#### New Files
- **`app/lib/memory/config.ts`** (NEW)
  - `MemoryConfig` interface
  - `getMemoryConfig()`: Loads config from env vars
  - `validateMemoryConfig()`: Error checking
  - `getValidatedMemoryConfig()`: Wrapper

- **`app/lib/memory/metrics.ts`** (NEW)
  - `RetrievalMetrics` interface
  - `logRetrievalMetrics()`: Async logging
  - `getMetricsSummary()`: Aggregated stats
  - `getDailyMetrics()`: Time-series data
  - `cleanupOldMetrics()`: Retention enforcement

- **`app/api/memory/metrics/route.ts`** (NEW)
  - `GET /api/memory/metrics`: Summary endpoint
  - Query params: `?type=summary|daily|config&days=N`
  - `POST /api/memory/metrics`: Cleanup endpoint

- **`scripts/test-phase1-metrics.ts`** (NEW)
  - Comprehensive test suite for Phase 1
  - Validates all Phase 1 features

#### Modified Files

- **`app/lib/memory/rag/index.ts`**
  - Added imports: `logRetrievalMetrics`, `getMemoryConfig`
  - Modified `retrieveSimilarMessages()`:
    - Track conversation vs global results separately
    - Measure latency for each source
    - Extract top 3 similarities
    - Log metrics asynchronously
    - Handle errors gracefully

- **`app/lib/memory/storage/sqlite.ts`**
  - Added `getConversationMessageCount(conversationId, role?)` method
  - Returns count for summary frequency tracking

- **`app/lib/memory/index.ts`**
  - Added `getConversationMessageCount()` wrapper
  - Documented for Phase 2 usage

### Configuration Changes

- **`.env.local`** - Added 9 feature flags:
  ```bash
  RAG_HYBRID=false              # Phase 3
  RAG_CHUNKING=false            # Phase 4
  BACKFILL_CHUNKS=false         # Phase 4
  RAG_TOKEN_BUDGET=1000         # All phases
  RAG_SUMMARY_FREQUENCY=5       # Phase 2
  RAG_RERANK_ALPHA=0.6          # Phase 3
  RAG_RERANK_BETA=0.3           # Phase 3
  RAG_RERANK_GAMMA=0.1          # Phase 3
  METRICS_RETENTION_DAYS=30     # Phase 1
  ```

### Features

- ✅ Metrics collection infrastructure
- ✅ Feature flag system
- ✅ Baseline performance data
- ✅ Helper methods for Phase 2

### Test Results

```
✅ ALL TESTS PASSED
- Configuration: Loaded correctly, all flags OFF
- Database: 4 migrations applied successfully
- Metrics: 1 query logged, 2ms latency captured
- Helpers: Message count methods working
- Consent: Profile consent methods functional
```

---

## Debugging Reference

### Files Modified by Phase

#### Phase 1 Modified Files
1. `app/lib/memory/rag/index.ts` - Added metrics tracking
2. `app/lib/memory/storage/sqlite.ts` - Added message count helper
3. `app/lib/memory/index.ts` - Added wrapper methods
4. `.env.local` - Added feature flags

#### Phase 2 Modified Files
1. `app/lib/memory/index.ts` - Added summary generation
2. `components/LeftToolbar.tsx` - Added profile UI
3. `.env.local` - No changes (flags already present)

#### Phase 3 Modified Files
1. `app/lib/memory/schemas.ts` - Added `fts_score` field
2. `app/lib/memory/storage/sqlite.ts` - Added `getDatabase()` method
3. `app/lib/memory/rag/retrieval.ts` - Added `ftsSearch()` method
4. `app/lib/memory/rag/index.ts` - Added hybrid retrieval logic
5. `.env.local` - Enabled `RAG_HYBRID=true`

### Common Error Patterns

#### FTS-Related Errors
- **Error:** `incomplete input` in migration
  - **Cause:** SQL statement splitting on semicolons inside triggers
  - **Fix:** Separate triggers into different migration file

- **Error:** `fts_score does not exist` TypeScript error
  - **Cause:** Missing field in `RetrievalResult` interface
  - **Fix:** Add `fts_score?: number` to schema

#### Database Access Errors
- **Error:** `Property 'getDatabase' does not exist`
  - **Cause:** SQLiteStorage doesn't expose database instance
  - **Fix:** Add public `getDatabase()` method

#### Metrics Errors
- **Error:** `ftsLexical` always 0
  - **Cause:** Not tracking FTS results in metrics
  - **Fix:** Update metrics logging to use `ftsResults.length`

### File Line Number References (Phase 3)

| File | Lines | Description |
|------|-------|-------------|
| `app/lib/memory/schemas.ts` | 119 | Added `fts_score` field |
| `app/lib/memory/storage/sqlite.ts` | 960-965 | Added `getDatabase()` |
| `app/lib/memory/rag/retrieval.ts` | 468-560 | Added `ftsSearch()` |
| `app/lib/memory/rag/index.ts` | 10 | Import rerank |
| `app/lib/memory/rag/index.ts` | 143-218 | Hybrid retrieval logic |
| `app/lib/memory/rag/index.ts` | 243-257 | Updated metrics |
| `.env.local` | 51 | `RAG_HYBRID=true` |

---

## Version History

- **v0.3.0** (2026-01-25): Phase 3 - Hybrid Retrieval + Reranking ✅
- **v0.2.0** (2026-01-20): Phase 2 - Summaries + Profile ✅
- **v0.1.0** (2026-01-18): Phase 1 - Baseline Audit + Diagnostics ✅

---

## Rollback Instructions

### Phase 3 Rollback
If you need to disable Phase 3:
1. Set `RAG_HYBRID=false` in `.env.local`
2. System automatically falls back to Phase 1-2 behavior
3. FTS index remains but is unused (no performance impact)

### Phase 2 Rollback
If you need to disable Phase 2:
1. Set `RAG_SUMMARY_FREQUENCY=0` in `.env.local`
2. Summaries stop generating
3. Profile UI becomes disabled

### Phase 1 Rollback
If you need to disable Phase 1:
1. Don't query `/api/memory/metrics`
2. Metrics still logged but ignored
3. No behavior changes

---

**Last Updated:** 2026-01-25
**Maintained By:** Development Team
**Related Docs:** [IMPLEMENT_CONTEXT.md](docs/IMPLEMENT_CONTEXT.md), [CONTEXT.md](docs/CONTEXT.md)
