# OrthoAI Next Steps

This is a working checklist of the most practical steps to move OrthoAI forward, in order.

## 1) Runtime + Environment Setup
- Start llama.cpp server (OpenAI‑compatible API)
- Configure environment variables:
  - `LLM_BASE_URL=http://localhost:8080/v1`
  - `LLM_DEFAULT_MODEL=biomistral-7b-instruct`
  - `EMBEDDING_BASE_URL=http://localhost:8080/v1`
  - `EMBEDDING_MODEL=nomic-embed-text`

## 2) Local RAG Infrastructure
- Start ChromaDB (`npm run chroma-start`)
- Verify embeddings endpoint works (`/v1/embeddings`)
- Confirm Chroma collection creation on first run

## 3) Model Validation (Baseline)
- Run a 10‑prompt evaluation set:
  - 2 clinical consult prompts
  - 2 surgical planning prompts
  - 2 complications/risk prompts
  - 2 imaging dx prompts
  - 1 rehab/RTP prompt
  - 1 evidence brief prompt
- Record response quality, hallucinations, and failure modes

## 4) Decide Ingestion Strategy (Phase 0)
- Option A: Manual PDF ingestion (fastest)
- Option B: PubMed metadata ingestion
- Option C: Europe PMC OA full‑text ingestion

## 5) Build Minimum Ingestion Pipeline
- Define canonical schema (title, DOI/PMID, abstract, full text, study type)
- Implement chunking by section (abstract/methods/results/discussion)
- Embed and store in Chroma with metadata filters

## 6) RAG Prompting Improvements
- Add explicit “Evidence vs Hypothesis” labeling in response formatting
- Enforce structured outputs (tables, limitations, open questions)

## 7) Evaluation & Feedback Loop
- Use analytics to compare mode performance
- Tune model parameters (temperature, maxTokens) by mode
- Create a small “gold set” of ortho questions for regression testing

## 8) Optional Enhancements
- Evidence‑Map UI panel (citation graph + filters)
- Add imaging‑specific outputs (MRI sequence tables, grading systems)
- Add study registry integration (ClinicalTrials.gov)

## 9) Repo Hygiene
- Remove legacy template docs you no longer want
- Decide whether to keep voice and tools features
- Prepare first public README and repo description

## 10) Release Milestones
- **MVP (local research assistant)**
- **MVP+ (PDF ingestion + citations)**
- **RAG v1 (PubMed + OA full‑text)**
- **RAG v2 (citation graph + evidence map)**

---

## Audit Checklist (Repo Improvements)

## Progress Tracking

This section logs completed checklist items in order, with brief notes and dates.

- [x] Initialized progress tracking.
- [x] Persisted `conversationId` across requests and added streaming metadata propagation. `app/api/llm/route.ts` `components/Chat.tsx`
- [x] Fixed strategy feedback ID detection to match `dec_*`/`fallback_*`. `app/api/feedback/route.ts`
- [x] Added buffered SSE parsing on server and client to avoid dropped tokens. `app/api/llm/route.ts` `components/Chat.tsx`
- [x] Removed duplicate user-message save in workflow branch. `app/api/llm/route.ts`
- [x] Added FTS insert/update/delete triggers to keep `messages_fts` current. `app/lib/memory/migrations/007_fts_triggers.sql`
- [x] Corrected FTS BM25 ordering and normalization (lower is better). `app/lib/memory/rag/retrieval.ts` `app/lib/memory/rag/rerank.ts`
- [x] Added embedding metadata creation so status updates are valid. `app/lib/memory/index.ts`
- [x] Capped strategy `maxTokens` to model context windows. `app/lib/strategy/manager.ts`
- [x] Reworked ensemble workflow to return actual responses (not verdicts). `app/lib/strategy/workflows/ensemble.ts` `app/lib/strategy/orchestrator.ts`
- [x] Aligned analytics/learning DBs to `.data/` for consistency with memory. `app/lib/domain/modeAnalytics.ts` `app/lib/strategy/analytics/tracker.ts` `app/lib/learning/*`
- [x] Disabled DL codegen API endpoints to match OrthoAI scope. `app/api/dl-codegen/*`
- [x] Wired Memory toggle to control memory augmentation (`useMemory`). `app/api/llm/route.ts` `components/Chat.tsx`
- [x] Disabled generic tools by default (guarded by `ENABLE_GENERIC_TOOLS`). `app/lib/tools/index.ts`
- [x] Replaced `require()` in tools index with static imports. `app/lib/tools/index.ts`
- [x] Updated migration script DB path to match runtime storage. `scripts/run-migration.ts`
- [x] Guarded `code_exec` behind `ENABLE_CODE_EXEC` and removed it from tools by default. `app/lib/tools/index.ts` `app/lib/tools/handlers/code-exec.ts`
- [x] Switched STT to async spawn and gated debug WAV output. `app/api/stt/route.ts`
- [x] Made Piper TTS command OS-aware with configurable Python command. `app/api/piper-tts/route.ts`
- [x] Added optional per-request LLM fetch timeout via `LLM_REQUEST_TIMEOUT_MS`. `app/api/llm/route.ts`
- [x] Auto mode analytics now records the actual detected mode. `app/lib/domain/contextBuilder.ts` `app/api/llm/route.ts` `components/Chat.tsx`
- [x] Standardized gradients to `bg-gradient-to-*` for broader Tailwind compatibility. `app/layout.tsx` `app/page.tsx` `app/analytics/page.tsx` `components/*`
- [x] Replaced emoji metadata icons with actual favicon assets. `app/layout.tsx`
- [x] Updated empty-state copy to orthopedics-specific messaging. `components/Chat.tsx`
- [x] Updated Learning Dashboard empty-state copy to OrthoAI modes. `components/LearningDashboard.tsx`
- [x] Moved legacy Hacker Reign docs into `docs/legacy/` with a README note. `docs/legacy/README.md`
- [x] Rewrote learning system docs for OrthoAI themes and feedback flow. `app/lib/learning/README.md`
- [x] Moved legacy test scripts to `scripts/legacy/` with a README note. `scripts/legacy/README.md`
- [x] Updated changelog header to OrthoAI context (legacy note added). `CHANGELOG.md`

### Critical (Correctness/Data Flow)
- [ ] Persist conversation IDs across requests; add SSE metadata for `conversationId` and store it client‑side. `app/api/llm/route.ts` `components/Chat.tsx`
- [ ] Fix strategy feedback logging: strategy IDs are `dec_*`, but feedback checks for `decision_*`. `app/api/feedback/route.ts` `app/lib/strategy/baseStrategy.ts`
- [ ] Fix SSE parsing on both server and client to buffer partial lines; current `split('\n')` can drop tokens. `app/api/llm/route.ts` `components/Chat.tsx`
- [ ] Remove duplicate user‑message save in the workflow branch. `app/api/llm/route.ts`
- [ ] Add FTS triggers for insert/update/delete; `messages_fts` is only backfilled, so it becomes stale. `app/lib/memory/migrations/007_fts_triggers.sql`
- [ ] Verify BM25 ordering and fix if needed (FTS5 BM25 is typically lower‑is‑better; current `ORDER BY bm25_score DESC` likely inverted). `app/lib/memory/rag/retrieval.ts`
- [ ] Create `embedding_metadata` rows before updating status; current updates are no‑ops because nothing is inserted. `app/lib/memory/index.ts` `app/lib/memory/storage/sqlite.ts` `app/lib/memory/rag/index.ts`
- [ ] Cap strategy `maxTokens` to model context windows; several strategies request 16k–20k for 7B models. `app/lib/strategy/implementations/*` `app/lib/strategy/resources/constraints.ts`
- [ ] Ensemble workflow currently returns verdicts (“YES/NO/MAYBE”), not answers; redesign or limit it to internal evaluation. `app/lib/strategy/workflows/ensemble.ts` `app/lib/strategy/orchestrator.ts`

### High (Architecture/Consistency)
- [ ] Align analytics storage: memory uses `.data/orthoai.db`, while strategy/mode/learning use `data/*.db`. Pick one and document it. `app/lib/memory/index.ts` `app/lib/domain/modeAnalytics.ts` `app/lib/strategy/analytics/tracker.ts` `app/lib/learning/*`
- [ ] Remove or fully disable DL codegen endpoints and library to match refactor decision. `app/api/dl-codegen/*` `app/lib/dl-codegen/*`
- [ ] Memory toggle currently only controls profile consent; wire it to memory augmentation or rename the control. `components/LeftToolbar.tsx` `app/api/llm/route.ts`
- [ ] Replace or disable non‑orthopedic tools (`weather`, `code_exec`, `calc`) until domain tools exist. `app/lib/tools/*`
- [ ] Replace `require()` usage in ESM tools with static imports. `app/lib/tools/index.ts`
- [ ] Update `run-migration.ts` to use the same DB path as the app. `scripts/run-migration.ts`

### Security/Robustness
- [ ] `code_exec` executes arbitrary code and pulls Pyodide from a CDN; either sandbox more tightly or remove for local‑first. `app/lib/tools/handlers/code-exec.ts`
- [ ] STT uses `execSync` and writes a persistent debug WAV; switch to async spawn and gate debug output. `app/api/stt/route.ts`
- [ ] `arch -arm64` in Piper TTS is mac‑only; add OS detection or a configurable command. `app/api/piper-tts/route.ts`
- [ ] Global undici timeouts set to zero; consider per‑request aborts to avoid hanging fetches. `instrumentation.ts`

### Product/UX
- [ ] Auto mode analytics should include actual mode so feedback tracks the right bucket. `app/api/llm/route.ts` `components/Chat.tsx`
- [ ] Verify `bg-linear-to-*` utilities for your Tailwind version; if unsupported, gradients won’t render. `app/layout.tsx` `app/page.tsx` `app/analytics/page.tsx` `components/*`
- [ ] Metadata icons set to emojis; use actual icon assets. `app/layout.tsx`
- [ ] Replace empty‑state copy with orthopedics‑specific messaging. `components/Chat.tsx`
- [ ] Learning dashboard empty‑state copy still references coding; update to OrthoAI modes. `components/LearningDashboard.tsx`

### Docs & Scripts
- [ ] Update or prune legacy Hacker Reign docs. `docs/WORKFLOW_GUIDE.md` `docs/DASHBOARD.md` `docs/MODELS.md` `docs/PROFILES.md` `docs/OUTLINE.md` `docs/RAM.md` `docs/RESEARCH.md` `docs/INFO_FLOW.md` `docs/CLEANING.md` `docs/STRUCTURE.md`
- [ ] Learning docs describe coding themes and outdated behavior; rewrite for orthopedics and current feedback flow. `app/lib/learning/README.md`
- [ ] Test scripts are coding‑specific and use `tsx` (not in deps); update or remove. `scripts/test-phase1-metrics.ts` `scripts/test-phase2-summaries.ts` `scripts/test-phase3-hybrid.ts`
- [ ] Changelog references Hacker Reign and old model sets; update to OrthoAI context. `CHANGELOG.md`
