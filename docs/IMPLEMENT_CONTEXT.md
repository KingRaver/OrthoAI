# Memory Implementation Context (OrthoAI)

**Last validated:** 2026-02-07  
**Repository scope:** `/Users/jeffspirlock/OrthoAI`  
**Purpose:** Current-state implementation map for memory/RAG, including legacy carry-over notes and a prioritized recovery checklist.

---

## 1) Scope and Ground Rules

This document is now **repo-local** and only describes what exists in this OrthoAI directory.

- If a feature is only documented in old plans but not present in this repo, it is treated as **not implemented here**.
- Runtime observations are based on the current local DB (`.data/orthoai.db`) and code paths in this repo.
- This file supersedes earlier cross-directory assumptions.

---

## 2) Legacy vs Current (Hacker Reign -> OrthoAI)

### Legacy (reference only)

The following are retained for historical context and are not current implementation truth:

- `docs/legacy/*` (explicitly marked Hacker Reign context)
- `scripts/legacy/*` (legacy phase test scripts)
- Any references to `Hacker Reign`, coding-assistant workflows, or `.data/hackerreign.db`

### Current (source of truth)

- `README.md` (OrthoAI product overview)
- `docs/STARTUP.md` (current local runtime startup)
- `docs/audits/ROADMAP.md` (current roadmap framing)
- `app/lib/memory/*`, `app/api/memory/*`, `app/api/profile/*` (actual memory implementation)
- `.data/orthoai.db` (active memory database path)

### Migration interpretation

- The old memory roadmap content was partially imported.
- Some features were implemented, some are scaffolded only, and some are still absent.
- Performance degradation should be treated as a **current OrthoAI integration/stabilization issue**, not just legacy noise.

---

## 3) Current Implementation Matrix (OrthoAI)

### Phase 1: Baseline metrics and config

**Status:** Implemented

- `app/lib/memory/migrations/004_retrieval_metrics.sql`
- `app/lib/memory/config.ts`
- `app/lib/memory/metrics.ts`
- `app/api/memory/metrics/route.ts`

**Notes**

- Metrics are being written in production code path.
- Writes are "async from caller perspective" but the DB writes themselves are synchronous once executed.

### Phase 2: Summaries and profile

**Status:** Partially operational (code present, runtime behavior needs stabilization)

- Auto-summary trigger exists in `app/lib/memory/index.ts` (`saveMessage()`).
- Summary generation exists in `app/lib/memory/index.ts` (`generateConversationSummary()`).
- Profile API exists in `app/api/profile/route.ts`.
- Consent API exists in `app/api/memory/consent/route.ts`.
- Profile UI exists in `components/LeftToolbar.tsx`.

**Gaps observed**

- In current local DB snapshot, `conversation_summaries` has zero rows despite at least one conversation meeting summary trigger count.
- Indicates summary pipeline is implemented but not reliably producing persisted summaries in this environment.

### Phase 3: Hybrid retrieval and reranking

**Status:** Implemented in code, not currently active in runtime config

- FTS retrieval: `app/lib/memory/rag/retrieval.ts` (`ftsSearch`)
- Reranking: `app/lib/memory/rag/rerank.ts`
- Hybrid branch integration: `app/lib/memory/rag/index.ts`
- FTS migrations: `006_fts_index.sql`, `007_fts_triggers.sql`

**Gaps observed**

- Runtime metrics show hybrid path not active (`flag_hybrid=0` in current snapshot).
- FTS table has substantial duplicate rows (see performance snapshot below), which increases write overhead and can degrade lexical query quality.

### Phase 4: Chunking and chunk-aware budgeting

**Status:** Implemented (pending canary validation)

- `app/lib/memory/chunking.ts` now provides code/prose chunk segmentation.
- `015_message_chunking.sql` adds `message_chunks` + `chunks_fts` with sync triggers.
- Chunk embedding and retrieval are wired in memory RAG (`app/lib/memory/rag/index.ts`, `app/lib/memory/rag/retrieval.ts`).

### Phase 5: Memory settings UI and preferences API

**Status:** Implemented (initial release)

- `user_preferences` table exists.
- `/api/memory/preferences` now supports runtime GET/POST controls.
- Toolbar now exposes hybrid/chunking/token budget/summary frequency controls and persists them.

---

## 4) Runtime Performance Snapshot (Current Directory)

**Snapshot date:** 2026-02-07  
**Data source:** `.data/orthoai.db`

### Retrieval metrics snapshot

- Total retrievals logged: `21`
- Average latency: `174.3ms`
- p95 latency: `387ms`
- Max latency: `409ms`
- Hybrid active count: `0`
- Chunking active count: `0`

### Storage/index snapshot

- `messages`: `55`
- `messages_fts`: `335`
- Distinct FTS `message_id`: `55`
- Orphan FTS rows: `0`
- Interpretation: high duplication per message in FTS index (write amplification and noisy lexical scoring risk)

### Summary/profile snapshot

- `conversation_summaries`: `0`
- `user_profile`: `0`
- Interpretation: profile and summary features are present but not currently producing durable data in this runtime snapshot

---

## 5) Known Degradation Risks in Current Build

1. Hot-path synchronous writes during retrieval
- `search_queries` logging and `retrieval_metrics` logging add synchronous SQLite work per retrieval request.

2. Summary generation competes with primary LLM capacity
- Summary jobs call the same chat-completions endpoint used for user responses.
- Under load, this can increase tail latency for user requests.

3. FTS duplication inflates write/read cost
- Duplicate `messages_fts` rows increase trigger/write overhead and can distort lexical rank behavior.

4. Feature state mismatch
- Code paths exist for hybrid/summaries/profile, but runtime data shows low activation/throughput.
- This creates complexity cost without full benefit.

---

## 6) Recovery Checklist (High-Level Implementation Plan)

This checklist is prioritized to restore performance first, then complete missing capabilities.

### Track A: Stabilize existing memory pipeline (P0)

**Goal:** Remove avoidable hot-path overhead and harden memory network calls so retrieval latency remains predictable under load.

**A1. Hot-path write controls**

- [x] Add a feature flag to disable or sample `retrieval_metrics` logging in hot path.
- [x] Add a feature flag to disable or sample `search_queries` logging in hot path.
- [x] Gate memory debug logs behind `DEBUG_*` flags to reduce console overhead.

**A2. Background request hardening**

- [x] Add hard timeout + retry policy for summary generation calls.
- [x] Add hard timeout + retry policy for embedding calls.

**A3. Operational visibility**

- [x] Add operational visibility endpoint for queue depth + recent failures.

**Track A patch log (2026-02-07)**

- Config/flags and sampling controls: `app/lib/memory/config.ts`
- Retrieval metrics gating/sampling: `app/lib/memory/metrics.ts`
- Search query logging gating/sampling: `app/lib/memory/rag/retrieval.ts`
- Summary timeout/retry policy wiring: `app/lib/memory/index.ts`
- Embedding timeout/retry policy wiring: `app/lib/memory/rag/embeddings.ts`
- Debug log gating helper: `app/lib/memory/debug.ts`
- Ops visibility endpoint: `app/api/memory/ops/route.ts`
- Ops counters + recent failure snapshot: `app/lib/memory/ops.ts`

**Track A validation notes**

- Code-level verification confirms all Track A controls are implemented and wired to environment-driven configuration.
- Runtime SLO validation remains open until canary metrics are collected under sustained real workload.

**Track A exit criteria**

- [ ] p95 retrieval latency meets target with `RAG_METRICS_ENABLED=true` and sampling enabled.
- [ ] `/api/memory/ops` surfaces queue depth and recent failures during failure-injection checks.
- [ ] Summary and embedding requests respect configured timeout/retry envelopes during upstream degradation.

### Track B: Repair FTS integrity and hybrid readiness (P0/P1)

**Goal:** Restore lexical index integrity and re-enable hybrid retrieval behind measurable canary gates.

**B1. FTS repair tooling**

- [x] Add one-time FTS rebuild script (truncate/rebuild `messages_fts` from `messages`).  
  Implemented: `scripts/rebuild-messages-fts.mjs`
- [x] Add an integrity check script: total rows, distinct message IDs, duplicate ratio.  
  Implemented: `scripts/fts-integrity-check.mjs`

**B2. Integrity execution and hybrid canary setup**

- [x] Run FTS rebuild on current DB and validate duplicate ratio target (`1.0` rows per message).  
  Result: PASS (`messages_fts` rows/message ratio now `1.0`, duplicate extra rows `0`)
- [x] After integrity pass, canary-enable `RAG_HYBRID=true` in local/staging.  
  Local canary set in `.env.local`

**B3. Canary measurement gate**

- [ ] Collect 24h metrics and compare latency/quality before wider enablement.  
  Baseline report added: `scripts/memory-canary-report.mjs` (run after 24h window)

**Track B patch log (2026-02-07)**

- FTS integrity checker: `scripts/fts-integrity-check.mjs`
- FTS rebuild utility: `scripts/rebuild-messages-fts.mjs`
- Canary metrics report: `scripts/memory-canary-report.mjs`
- Script wiring for repeatable execution: `package.json`

**Track B validation notes**

- FTS repair/integrity scripts are present and runnable via package scripts.
- Latest documented integrity run passed with duplicate ratio target achieved.
- 24h hybrid canary comparison is still pending and remains the release gate for broader enablement.

**Track B exit criteria**

- [ ] `messages_fts` duplicate extra rows remain `0` across repeated integrity checks.
- [ ] 24h canary with `RAG_HYBRID=true` shows no p95 latency regression beyond agreed tolerance.
- [ ] Retrieval quality metrics are equal or improved before rollout beyond canary scope.

### Track C: Make summaries/profile operationally reliable (P1)

**Goal:** Make summary/profile behavior deterministic, observable, and consent-safe before enabling broader memory features.

**C1. Observability and state model**

- [x] Define summary job states (`queued`, `running`, `succeeded`, `failed`, `skipped_no_consent`) and emit structured events.
- [x] Persist per-conversation summary health fields (`last_run_at`, `last_success_at`, `last_error`, `consecutive_failures`).
- [x] Expose summary health in a runtime endpoint/metrics surface (success rate, failure rate, retries, current backlog).

**C2. Reliability controls**

- [x] Add bounded queueing and per-conversation locking so summary jobs are serialized and not duplicated.
- [x] Implement retry/backoff policy with hard timeout, capped attempts, and terminal-failure recording.
- [x] Add a simple circuit-breaker mode that pauses new summary work during repeated upstream LLM failures.
- [x] Enforce consent at enqueue and execute time; on revocation, clear profile-derived fields and block new summary writes.

**C3. Verification and release gates**

- [x] Add integration test: summary row is persisted after N assistant turns (including process restart resilience).  
  Added: `__tests__/memory.track-c.test.ts`
- [x] Add integration test: transient summary failure recovers and eventually persists summary on retry.  
  Added: `__tests__/memory.track-c.test.ts`
- [x] Add integration test: consent revocation clears profile data and excludes profile memory from retrieval context.  
  Added: `__tests__/memory.track-c.test.ts`
- [x] Add a canary report for 24h runtime showing summary/profile reliability KPIs and failure causes.  
  Updated: `scripts/memory-canary-report.mjs`

**Track C patch log (2026-02-07)**

- Schema/migration: `app/lib/memory/migrations/014_summary_operational_health.sql`
- Types/contracts: `app/lib/memory/schemas.ts`
- Core runtime controls: `app/lib/memory/index.ts`
- Storage instrumentation and summary health queries: `app/lib/memory/storage/sqlite.ts`
- Memory config controls (queue/retry/circuit): `app/lib/memory/config.ts`
- Ops visibility endpoint: `app/api/memory/ops/route.ts`
- Consent revocation enforcement path: `app/api/memory/consent/route.ts`
- Storage singleton/db-path alignment: `app/lib/memory/storage/index.ts`
- Integration tests: `__tests__/memory.track-c.test.ts`
- Canary reliability reporting: `scripts/memory-canary-report.mjs`

**Track C validation notes**

- Lint on modified Track C files: pass.
- Track C integration tests: **3/3 passing** (after `npm rebuild better-sqlite3` to compile native bindings for current Node v23.3.0).
- Exit criteria remain open until 24h canary reliability targets are measured in a healthy runtime.

**Track C exit criteria**

- [ ] Summary success rate >= `99%` over a 24h canary window.
- [ ] Zero summary/profile writes when consent is disabled.
- [ ] Every profile change is attributable to a logged summary event with timestamp and conversation ID.

### Track D: Complete missing roadmap features (P2)

**Goal:** Enable chunk-level memory retrieval and operator controls so memory quality can scale without uncontrolled prompt growth.

**D1. Chunk schema and chunking pipeline**

- [x] Implement chunking migration and chunk schema for memory messages.
- [x] Implement `chunkMessage()` with code/prose chunk kinds.

**D2. Retrieval and context assembly**

- [x] Implement chunk embedding + chunk retrieval path.
- [x] Add chunk-aware context assembly with strict token budget.

**D3. Runtime controls and UX**

- [x] Build `/api/memory/preferences` and wire memory settings in toolbar.

**Track D patch log (2026-02-07)**

- Chunk schema migration: `app/lib/memory/migrations/015_message_chunking.sql`
- Chunking utility: `app/lib/memory/chunking.ts`
- Chunk persistence and row types: `app/lib/memory/storage/sqlite.ts`
- Chunk embedding + chunk metadata retrieval: `app/lib/memory/rag/retrieval.ts`
- Chunk-aware context assembly and ingest wiring: `app/lib/memory/rag/index.ts`
- Retrieval schema expansion for chunk metadata: `app/lib/memory/schemas.ts`
- Runtime preference helpers: `app/lib/memory/preferences.ts`
- Preference API endpoint: `app/api/memory/preferences/route.ts`
- Memory init preference bootstrap + context call-through: `app/lib/memory/index.ts`
- Request-time preference propagation: `app/api/llm/route.ts`, `components/Chat.tsx`
- Toolbar controls for hybrid/chunking/token budget/summary frequency: `components/LeftToolbar.tsx`

**Track D validation notes**

- Lint on modified Track D files: pass.
- Type-check: no Track D-specific type errors (pre-existing esModuleInterop issues unrelated to Track D).
- Migration 015 applied to live DB (2026-02-07): `message_chunks`, `chunks_fts` tables created.
- Preferences API (`/api/memory/preferences`) verified: GET/POST routes present and well-formed.
- Full repository type-check still fails due pre-existing unrelated issues in case routes/pages and legacy scripts; no new Track D-specific type errors surfaced during lint validation.

### Track E: Validate and ship safely (P2)

**Goal:** Establish objective release gates for memory performance and a deterministic rollback path.

**E1. Performance SLO targets**

- [x] Define SLO targets for memory retrieval latency (avg, p95, p99).  
  Targets (24h canary): `avg <= 180ms`, `p95 <= 450ms`, `p99 <= 700ms`

**E2. Benchmark and release artifacts**

- [x] Add benchmark script for dense-only vs hybrid vs chunked retrieval.  
  Added: `scripts/memory-retrieval-benchmark.mjs`, `npm run memory:benchmark:retrieval`
- [x] Add release checklist with rollback toggles for each memory feature.  
  Added: `docs/audits/MEMORY_RELEASE_CHECKLIST.md`

**E3. Operational defaults documentation**

- [x] Document final defaults in `docs/STARTUP.md` and memory README.

**Track E patch log (2026-02-07)**

- Retrieval benchmark script: `scripts/memory-retrieval-benchmark.mjs`
- Benchmark script wiring: `package.json`
- Release checklist + rollback playbook: `docs/audits/MEMORY_RELEASE_CHECKLIST.md`
- Startup defaults and benchmark commands: `docs/STARTUP.md`
- Memory README defaults and Track E gate commands: `app/lib/memory/README.md`

**Track E validation notes**

- Lint on Track E modified files: pass.
- Benchmark script verified: `npm run memory:benchmark:retrieval` executes and reports dense/hybrid/chunked modes with SLO evaluation.
- FTS integrity script verified: `npm run memory:fts:check` passes (duplicate ratio 1.0).
- Canary report script verified: `npm run memory:canary:report` now reports summary/profile reliability KPIs (after migration 014 applied).
- Migration 014 applied to live DB (2026-02-07): `summary_health`, `summary_events` tables created.
- Full repository type-check still has unrelated pre-existing failures (case routes/pages and legacy scripts); Track E changes are documentation + script additions and do not introduce new lint failures.

---

## 7) Immediate Next Actions (Recommended Order)

1. Complete **Track A** and **Track B** before enabling any additional features.  
2. Verify summary reliability from **Track C** in the active runtime.  
3. Run **Track D** canary with chunking enabled and collect chunk vs non-chunk retrieval quality/latency deltas.  
4. Use **Track E** as release gate before broad rollout.

---

## 8) Status Summary

- Legacy roadmap content was useful but not fully carried over.
- Current OrthoAI memory system is **partially integrated**.
- The fastest path back on track is:
  - stabilize existing paths,
  - fix FTS integrity,
  - prove summaries/profile reliability,
  - validate chunking/preferences under canary load before broad enablement.
