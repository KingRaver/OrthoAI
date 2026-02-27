# Changelog

## [Unreleased] - 2026-02-27

### Changed
- **Test suite hardened and expanded** (56 → 78 passing tests, +22 net new assertions)
  - `domain.mode-definitions`: enumerate all 7 mode keys by name; validate temperature [0.2, 0.3] and maxTokens [5500, 6500] per mode; assert system prompt length >100 chars per mode
  - `domain.context-detector`: pin all 4 confidence boundary values exactly (0.8/0.6/0.4/0.39); add unicode/emoji safety test; add protocol and dataset file-type detection tests; assert `reasoning` field always populated
  - `knowledge.ranking`: add dynamic-date recency tier tests (+0.08/+0.04/no bonus) that remain valid in future years; validate all 5 ordinal ranks; add empty-publicationTypes → level-5 fallback; use `toBeCloseTo` for float-safe score assertions
  - `memory.ops`: assert failure ID matches `memfail_` prefix; validate category isolation (summary counters don't affect embedding); test Error-vs-string message normalization
  - `memory.fetch`: add AbortError retry test; 429 rate-limit retry; 401 non-retry; exhausted-retries re-throw with correct call count (3 total for retries:2)
  - `memory.chunking`: add code-only content test; `maxChunkTokens: 10` clamped-to-80 test; language tag normalization (`TS` → `ts`)
  - `calc`: add non-finite result (`1/0` → Infinity) throw test; non-string expression throw test
  - `domain.context-builder`: add `formatContextInfo()` output validation (Mode/Confidence/Domain fields); non-clinical input → `domainKnowledgeInjected: false`
  - `memory.rerank`: add empty-array → empty-result test; undefined `fts_score` no-throw test
  - `strategy.orchestrator`: add `beforeEach(vi.clearAllMocks)` + `afterEach(vi.restoreAllMocks)` to prevent spy leakage; add explicit token arithmetic comment for combined workflow
- **Comprehensive core-module test suites added**
  - `llm.config`: default/fallback behavior, URL normalization, model-specific endpoint precedence (`LLM_BASE_URL_<MODEL>` over JSON map), invalid JSON fallback, timeout clamping
  - `memory.config-preferences`: env parsing/validation, runtime preference normalization/clamping, env apply/read-back, storage read/persist adapter coverage
  - `memory.fetch`: retry policy coverage for retryable status codes and fetch errors, non-retryable status/error behavior
  - `memory.chunking`: mixed prose/code chunking metadata checks, empty-content handling, long-prose splitting behavior with estimator-tolerant bounds
  - `memory.ops`: per-category counter tracking, failure history capping, snapshot limit clamping
  - `memory.rerank`: identifier extraction (code blocks/inline/casing/function calls), dedupe/rerank weighting, conversation/global merge behavior
  - `knowledge.ranking`: evidence-level classification + ordinal mapping across review/RCT/case-series/fallback paths
  - `tools`: environment gating (`ENABLE_GENERIC_TOOLS`, `ENABLE_CODE_EXEC`) and tool execution/error-path assertions
  - `strategy.context`: context assembly, detection cache behavior, complexity floor behavior for clinical content
  - `strategy.orchestrator`: combined/chain/ensemble execution metadata + token aggregation and no-op resource-constraint verification
- **Track C test portability hardened**
  - `memory.track-c` suite now performs a `better-sqlite3` probe and auto-skips when native bindings are unavailable on the active runtime/toolchain
  - Prevents hard failures on environments where the SQLite native module cannot be loaded while preserving full execution on supported setups

### Files Modified
- `__tests__/domain.mode-definitions.test.ts`
- `__tests__/domain.context-detector.test.ts`
- `__tests__/knowledge.ranking.test.ts`
- `__tests__/memory.ops.test.ts`
- `__tests__/memory.fetch.test.ts`
- `__tests__/memory.chunking.test.ts`
- `__tests__/calc.test.ts`
- `__tests__/domain.context-builder.test.ts`
- `__tests__/memory.rerank.test.ts`
- `__tests__/strategy.orchestrator.test.ts`
- `__tests__/llm.config.test.ts`
- `__tests__/memory.config-preferences.test.ts`
- `__tests__/strategy.context.test.ts`
- `__tests__/tools.test.ts`
- `__tests__/memory.track-c.test.ts`

---

## [Unreleased] - 2026-02-07

### Added
- **Multi-model endpoint routing** for ensemble workflows
  - Models can now run on separate llama-server instances (different ports)
  - Configure via `LLM_BASE_URL_<MODEL>` env vars (e.g., `LLM_BASE_URL_BIOGPT=http://127.0.0.1:8082/v1`)
  - Falls back to `LLM_BASE_URL` if no model-specific endpoint is configured
  - Updated `docs/STARTUP.md` with configuration instructions
- **Track D chunking foundation**
  - Added message chunk schema + chunk FTS migration (`015_message_chunking.sql`)
  - Added `chunkMessage()` utility to segment prose/code for chunk-level embeddings
  - Added `/api/memory/preferences` endpoint for runtime memory controls
  - Added toolbar controls for hybrid, chunking, token budget, and summary frequency
- **Track E release gating artifacts**
  - Added retrieval benchmark script (`scripts/memory-retrieval-benchmark.mjs`)
  - Added memory release checklist + rollback toggles (`docs/audits/MEMORY_RELEASE_CHECKLIST.md`)
  - Documented Track E defaults and benchmark commands in startup + memory docs

### Changed
- **Improved ensemble error handling**
  - Ensemble now logs individual model failures with detailed error messages
  - Gracefully degrades when some models fail (continues with successful ones)
  - Error messages include model name and endpoint URL for easier debugging
- **Memory retrieval pipeline now supports chunk-level paths**
  - RAG ingest now persists and embeds chunks when `RAG_CHUNKING=true`
  - FTS retrieval now merges `messages_fts` + `chunks_fts` when chunking is enabled
  - Memory context assembly is chunk-aware and enforces token budget with code-chunk prioritization for code-heavy queries
- **Memory runtime preferences now apply immediately**
  - Preferences are loaded from SQLite at memory init and mirrored to runtime env
  - Request-time overrides are accepted from chat payload for immediate effect on the next LLM call

### Fixed
- Ensemble workflow failing silently when one model was unreachable
- JSON parsing issues with `MODEL_ENDPOINTS` env var replaced with simpler `LLM_BASE_URL_*` pattern

### Files Modified
- `app/lib/llm/config.ts` - Added `getLlmChatUrlForModel()` with per-model endpoint lookup
- `app/lib/strategy/workflows/ensemble.ts` - Added failure logging and per-model URL routing
- `docs/STARTUP.md` - Documented multi-model endpoint configuration
- `.env.local` - Added model-specific endpoint variables
- `app/lib/memory/migrations/015_message_chunking.sql` - Added message chunk + chunk FTS schema
- `app/lib/memory/chunking.ts` - Added chunk segmentation utility
- `app/lib/memory/preferences.ts` - Added runtime preference normalization/persistence helpers
- `app/api/memory/preferences/route.ts` - Added memory preference API
- `app/lib/memory/rag/retrieval.ts` - Added chunk embedding ingest + chunk FTS retrieval
- `app/lib/memory/rag/index.ts` - Added chunking ingest wiring + chunk-aware context assembly
- `app/lib/memory/storage/sqlite.ts` - Added chunk storage methods
- `components/LeftToolbar.tsx` - Added memory runtime controls
- `components/Chat.tsx` - Propagates memory preference settings with LLM requests
- `app/api/llm/route.ts` - Applies request-time memory preference overrides
- `scripts/memory-retrieval-benchmark.mjs` - Added dense vs hybrid vs chunked benchmark gate
- `docs/audits/MEMORY_RELEASE_CHECKLIST.md` - Added Track E release and rollback checklist
- `app/lib/memory/README.md` - Added Track E defaults + benchmark/checklist references
