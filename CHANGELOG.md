# Changelog

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
