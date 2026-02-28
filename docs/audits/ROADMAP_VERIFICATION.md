# ROADMAP Verification

**Source roadmap:** `docs/audits/ROADMAP.md`  
**Verification date:** 2026-02-27  
**Scope:** Repository implementation evidence only (code/docs/config in this repo).

## Legend
- `FULL`: Implemented and wired end-to-end in current repo.
- `PARTIAL`: Implemented in part, scaffolded, or not fully wired/validated.
- `NOT BUILT`: No concrete implementation found in current repo.
- `OPS-ONLY`: Marked done in roadmap but only verifiable via runtime/bench/manual ops, not code artifacts alone.

## Evidence Index
- `E1` `app/lib/llm/config.ts:3-6,69,82,85-92`
- `E2` `package.json:2`
- `E3` `app/layout.tsx:24-59`
- `E4` `app/lib/memory/storage/index.ts:12-16`
- `E5` `docs/STARTUP.md:16-23,32-41,43-53,120-124`
- `E6` `app/lib/domain/modeDefinitions.ts:12-19,29-248`
- `E7` `app/lib/domain/domainKnowledge.ts:25-82`
- `E8` `app/lib/domain/contextDetector.ts:59-96,229-338`
- `E9` `app/lib/domain/contextBuilder.ts:38-49,63-82`
- `E10` `docs/audits/CLINICAL_REASONING_BENCHMARK.md:1-46`
- `E11` `components/LeftToolbar.tsx:16-24,319-362`
- `E12` `components/Chat.tsx:10,79-97,141,172,185-193,530-532,606-614`
- `E13` `components/LearningDashboard.tsx:67-68,350-368`
- `E14` `components/ParticleOrb.tsx:118-149`
- `E15` `app/lib/memory/rag/retrieval.ts:12-21,292-297,624-631,658-660`
- `E16` `app/lib/memory/rag/index.ts:210-265,435-480,585-657`
- `E17` `app/lib/memory/storage/sqlite.ts:198-206,217-239,385-396,417-425`
- `E18` `app/lib/memory/index.ts:45-79,111-114,175-185,199-207,226-289`
- `E19` `app/lib/memory/rag/embeddings.ts:17-18,185-198,224-231`
- `E20` `app/lib/strategy/context.ts:20-22,31-37`
- `E21` `app/lib/strategy/implementations/workflowStrategy.ts:35-38,57-59`
- `E22` `app/lib/learning/parameterTuner.ts:69-70,368-429`
- `E23` `app/lib/strategy/workflows/ensemble.ts:155-174,234-241`
- `E24` `instrumentation.ts:9-18`
- `E25` `app/api/llm/route.ts:22-23,101-104,433-435,670-672,806-808`
- `E26` `app/api/stt/route.ts:66-72`
- `E27` `app/api/piper-tts/route.ts:79-85`
- `E28` `app/lib/cases/types.ts:1-15`
- `E29` `app/lib/cases/index.ts:82-118,180-237,253-300`
- `E30` `app/api/cases/route.ts:5-39`
- `E31` `app/api/cases/[id]/events/route.ts:9-32`
- `E32` `app/api/cases/[id]/export/route.ts:9-24`
- `E33` `app/api/cases/[id]/link/route.ts:9-20`
- `E34` `app/cases/page.tsx:1-63`
- `E35` `app/cases/[id]/page.tsx:15-331`
- `E36` `components/CaseTimeline.tsx:12-23,46-81,166-210`
- `E37` `app/lib/knowledge/parsers/pdfParser.ts:11-58`
- `E38` `app/lib/knowledge/index.ts:141-191,194-241`
- `E39` `app/lib/codes/index.ts:79-105,177-203,275-301`
- `E40` `app/api/codes/icd10/route.ts:16-32`
- `E41` `app/api/codes/cpt/route.ts:16-32`
- `E42` `app/api/codes/drugs/route.ts:17-45`
- `E43` `app/lib/imaging/types.ts:1-126`
- `E44` `app/lib/imaging/index.ts:100-214,239-317,322-418`
- `E45` `app/lib/memory/migrations/012_imaging_system.sql:1-99`
- `E46` `components/DicomViewer.tsx:55-66,197-201,247-355`
- `E47` `app/lib/voice/server/sttService.ts:130-169,296-381,422-440`
- `E48` `app/lib/voice/server/piperService.ts:28-31,103-125,154-172`
- `E49` `app/lib/voice/audioRecorder.ts:22-79,141-150`
- `E50` `app/lib/voice/useVoiceInput.ts:59-68,140-146,261-264,300-313,336-341`
- `E51` `components/VoicePanel.tsx:83-101`
- `E52` `app/lib/knowledge/defaultSources.ts:17-71,73-164,177-297`
- `E53` `app/lib/knowledge/evidence/pubmedClient.ts:145-227`
- `E54` `app/lib/knowledge/evidence/cochraneClient.ts:9-27`
- `E55` `app/lib/knowledge/evidence/ranking.ts:40-103`
- `E56` `app/lib/knowledge/clinicalKnowledgeBase.ts:137-176,219-282,369-404,414-538,540-588,647-704,706-750,856-921`
- `E57` `app/api/knowledge/sync/route.ts:15-94`
- `E58` `app/lib/memory/migrations/013_clinical_knowledge_base.sql:22-177`
- `E59` `app/api/llm/route.ts:218-277,295-345,347-386`
- `E60` `docs/build/BUILD_DECISIONS.md:262-266`
- `E61` `app/api/memory/ops/route.ts:8-43`
- `E62` `app/api/imaging/route.ts:7-46`
- `E63` `app/api/imaging/[id]/route.ts:11-56`
- `E64` `app/api/imaging/[id]/annotations/route.ts:11-48`
- `E65` `app/api/imaging/annotations/[id]/route.ts:11-37`
- `E66` `app/api/imaging/templates/route.ts:7-22`
- `E67` `app/api/imaging/comparisons/route.ts:7-36`
- `E68` `app/cases/[id]/page.tsx:75-100,158-185,435-540`
- `E69` `app/lib/knowledge/index.ts:268-293`
- `E70` `app/api/knowledge/search/route.ts:13-19`
- `E71` `app/lib/clinical/decisionSupport.ts:131-744`
- `E72` `app/api/clinical/decision-support/route.ts:11-78`
- `E73` `app/api/cases/[id]/decision-support/route.ts:27-95`
- `E74` `app/api/cases/[id]/dashboard/route.ts:10-22`
- `E75` `app/clinical/page.tsx:31-200`
- `E76` `app/lib/clinical/learning.ts:59-229`
- `E77` `app/api/cases/[id]/learning/route.ts:10-67`
- `E78` `app/api/cases/[id]/learning/corrections/route.ts:10-53`
- `E79` `app/lib/clinical/subspecialty.ts:41-221`
- `E80` `app/api/subspecialty/route.ts:7-94`
- `E81` `app/lib/memory/migrations/016_clinical_learning.sql:1-64`
- `E82` `app/lib/system/shutdownRegistry.ts:58-183`
- `E83` `instrumentation.ts:14-57`
- `E84` `app/api/stt/route.ts:47-107`
- `E85` `app/api/piper-tts/route.ts:38-133`
- `E86` `app/api/llm/route.ts:27-31,77-89,549-581,734-747,972-977`
- `E87` `app/lib/llm/resilience.ts:67-192`
- `E88` `app/api/health/route.ts:1-21`
- `E89` `app/lib/system/health.ts:183-222`
- `E90` `app/lib/system/performance.ts:31-126`
- `E91` `app/api/performance/route.ts:7-22`
- `E92` `app/api/analytics/route.ts:64-67`
- `E93` `components/LearningDashboard.tsx:61-72,79,137,476-520`
- `E94` `app/lib/system/logger.ts:1-77`
- `E95` `app/lib/strategy/implementations/workflowStrategy.ts:35-39,57-60,95-101`
- `E96` `app/lib/benchmarks/clinicalReasoning/types.ts:1-147`
- `E97` `app/lib/benchmarks/clinicalReasoning/scorer.ts:1-504`
- `E98` `app/lib/benchmarks/clinicalReasoning/cases.v1.json`
- `E99` `scripts/benchmark-clinical-decision-support.mjs`, `scripts/benchmark-clinical-llm.mjs`, `scripts/benchmark-clinical-reasoning.mjs`, `scripts/lib/clinical-benchmark-core.mjs`
- `E100` `app/lib/memory/migrations/017_clinical_benchmarks.sql:1-80`
- `E101` `__tests__/clinical.benchmark.scorer.test.ts:1-129`
- `E102` `docs/STARTUP.md:123-181`

## Design Principles
- Local-first, offline-capable | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E1`, `E4`, `E5`, `E52`, `E53` | Core chat/memory is local; evidence sync features are networked/optional.
- No in-code guardrails | Roadmap `[ ]` | Verified `FULL` | Evidence: `E6`, `E9` | Prompts explicitly avoid AI disclaimers.
- Analytics-driven iteration | Roadmap `[ ]` | Verified `FULL` | Evidence: `E13`, `E22`, `E25`, `app/lib/domain/modeAnalytics.ts:81-190`, `app/lib/strategy/analytics/tracker.ts:85-209`
- Privacy by design | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E4`, `E5`, `E53`, `E57` | Local storage exists; remote evidence mode can transmit queries externally.
- Biomedical specialization (BioMistral + BioGPT) | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E1`, `E5` | BioMistral is primary; BioGPT is deprecated and replaced by Meditron.
- Clinical reasoning first | Roadmap `[ ]` | Verified `FULL` | Evidence: `E6`, `E7`, `E8`, `E9`, `E10`

## Phase 1: MVP — Clinical Intelligence Foundation
### Core Infrastructure
- Rebrand from Hacker Reign to OrthoAI | Roadmap `[x]` | Verified `FULL` | Evidence: `E2`, `E3`
- Replace Ollama runtime with llama.cpp server | Roadmap `[x]` | Verified `FULL` | Evidence: `E1`, `E5`
- Configure BioMistral + BioGPT as primary models | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E1`, `E5`
- Update database path to `.data/orthoai.db` | Roadmap `[x]` | Verified `FULL` | Evidence: `E4`
- Validate llama.cpp server configuration on M4 hardware | Roadmap `[x]` | Verified `OPS-ONLY` | Evidence: `E5`
- Confirm embedding endpoint performance under load | Roadmap `[x]` | Verified `OPS-ONLY` | Evidence: `E5`
- Add bounded timeouts (10-20 min default) for LLM requests | Roadmap `[x]` | Verified `FULL` | Evidence: `E1`, `E24`

### Clinical Domain System
- Replace mode definitions for orthopedic clinical contexts | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`
- Rewrite domain knowledge base with orthopedic terminology | Roadmap `[x]` | Verified `FULL` | Evidence: `E7`
- Update context detection for clinical queries | Roadmap `[x]` | Verified `FULL` | Evidence: `E8`
- Align base system prompt for clinical reasoning | Roadmap `[x]` | Verified `FULL` | Evidence: `E9`
- Build clinical reasoning evaluation benchmark | Roadmap `[x]` | Verified `FULL` | Evidence: `E10`, `E96`, `E98`, `E99`, `E100`
- Create scoring rubric for diagnostic accuracy and treatment appropriateness | Roadmap `[x]` | Verified `FULL` | Evidence: `E10`, `E96`, `E97`, `E101`, `E102`
- Encode orthopedic examination protocols | Roadmap `[x]` | Verified `FULL` | Evidence: `E7`
- Add anatomical knowledge base | Roadmap `[x]` | Verified `FULL` | Evidence: `E7`

### Clinical Modes
- Diagnostic Mode (`clinical-consult`) | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`, `E11`
- Treatment Mode (`treatment-decision`) | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`, `E11`
- Imaging Mode (`imaging-dx`) | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`, `E11`
- Surgical Mode (`surgical-planning`) | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`, `E11`
- Rehab Mode (`rehab-rtp`) | Roadmap `[x]` | Verified `FULL` | Evidence: `E6`, `E11`

### Memory & RAG Foundation
- Replace Ollama embeddings with OpenAI-compatible embeddings | Roadmap `[x]` | Verified `FULL` | Evidence: `E1`, `E19`
- Update Chroma collection naming for OrthoAI | Roadmap `[x]` | Verified `FULL` | Evidence: `E15` (`orthoai_conversations`)
- Align summarization prompts for clinical context | Roadmap `[x]` | Verified `FULL` | Evidence: `app/lib/memory/index.ts` (summary prompt logic), `E18`
- Enforce `RAG_TOKEN_BUDGET` in prompt assembly | Roadmap `[x]` | Verified `FULL` | Evidence: `E16`
- Implement token budget estimator with trim logic | Roadmap `[x]` | Verified `FULL` | Evidence: `E16`
- Fix FTS query to preserve medical abbreviations | Roadmap `[x]` | Verified `FULL` | Evidence: `E15`
- Lower minimum FTS term length to 2 characters | Roadmap `[x]` | Verified `FULL` | Evidence: `E15`

### User Interface
- Expose clinical modes in LeftToolbar | Roadmap `[x]` | Verified `FULL` | Evidence: `E11`
- Update Chat component for clinical workflows | Roadmap `[x]` | Verified `FULL` | Evidence: `E12`
- Align LearningDashboard for clinical domain modes | Roadmap `[x]` | Verified `FULL` | Evidence: `E13`

## Phase 2: Performance Optimization
### Client Performance
- Lazy-load voice and 3D modules (dynamic import) | Roadmap `[x]` | Verified `FULL` | Evidence: `E12`
- Gate AudioContext creation until voice mode enabled | Roadmap `[x]` | Verified `FULL` | Evidence: `E49`, `app/lib/voice/useVoiceOutput.ts:77-86,154-164`
- Throttle audio level updates to 10-20 fps | Roadmap `[x]` | Verified `FULL` | Evidence: `E50`
- Virtualize message list for long conversations | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E12` | Windowed rendering exists, not full virtualization library.
- Memoize ReactMarkdown rendering per message ID | Roadmap `[x]` | Verified `FULL` | Evidence: `E12`
- Throttle scroll-to-bottom with requestAnimationFrame | Roadmap `[x]` | Verified `FULL` | Evidence: `E12`
- Reduce particle count on low-power devices | Roadmap `[x]` | Verified `FULL` | Evidence: `E14`
- Precompute particle jitter values | Roadmap `[x]` | Verified `FULL` | Evidence: `E14`

### RAG Pipeline
- Remove N+1 SQLite lookups (`IN` clause batching) | Roadmap `[x]` | Verified `FULL` | Evidence: `E17`, `E15`
- Remove `embeddings` from Chroma query includes | Roadmap `[x]` | Verified `FULL` | Evidence: `E15` (`include: ['distances', 'documents', 'metadatas']`)
- Add `limit` and `order` to `getConversationMessages` | Roadmap `[x]` | Verified `FULL` | Evidence: `E17`
- Cache extracted code identifiers at message ingest | Roadmap `[x]` | Verified `FULL` | Evidence: `E18`
- Implement connection pooling for Chroma client | Roadmap `[x]` | Verified `FULL` | Evidence: `E15`

### Memory System
- Track applied migrations | Roadmap `[x]` | Verified `FULL` | Evidence: `E17`
- Use `PRAGMA user_version` or `schema_migrations` table | Roadmap `[x]` | Verified `FULL` | Evidence: `E17` (`schema_migrations`)
- Cap concurrent embedding/summary work with in-process queue | Roadmap `[x]` | Verified `FULL` | Evidence: `E18`
- Move summary generation to background job (fire-and-forget) | Roadmap `[x]` | Verified `FULL` | Evidence: `E18`
- Make embedding cache size configurable by env var | Roadmap `[x]` | Verified `FULL` | Evidence: `E19`
- Implement true LRU with access-time tracking | Roadmap `[x]` | Verified `FULL` | Evidence: `E19`

### Strategy & Orchestration
- Replace Jaccard with semantic cosine similarity in ensemble voting | Roadmap `[x]` | Verified `FULL` | Evidence: `E23`
- Cache theme detection per conversation (30s TTL) | Roadmap `[x]` | Verified `FULL` | Evidence: `E20`
- Add complexity threshold to bypass combined workflow (< 30) | Roadmap `[x]` | Verified `FULL` | Evidence: `E95`
- Increase parameter tuner buckets from 3 to 10 | Roadmap `[x]` | Verified `FULL` | Evidence: `E22`
- Implement weighted interpolation for sparse buckets | Roadmap `[x]` | Verified `FULL` | Evidence: `E22`

### Observability
- Gate verbose logs behind DEBUG flags | Roadmap `[x]` | Verified `FULL` | Evidence: `E25`, `E26`, `E27`
- Add metrics: render time, LLM latency, embedding queue depth | Roadmap `[x]` | Verified `FULL` | Evidence: `E12`, `E25`
- Track STT/TTS end-to-end duration | Roadmap `[x]` | Verified `FULL` | Evidence: `E26`, `E27`

## Phase 3: MVP+ — Patient Cases & Clinical Knowledge
### Patient Case System
- Patient case data model | Roadmap `[x]` | Verified `FULL` | Evidence: `E28`
- Case creation and editing interface | Roadmap `[x]` | Verified `FULL` | Evidence: `E34`, `E35`
- Case timeline view | Roadmap `[x]` | Verified `FULL` | Evidence: `E36`
- Link cases to conversations | Roadmap `[x]` | Verified `FULL` | Evidence: `E29`, `E33`, `E59`
- Export case summaries | Roadmap `[x]` | Verified `FULL` | Evidence: `E29`, `E32`
- Case context injection into LLM prompt | Roadmap `[x]` | Verified `FULL` | Evidence: `E59`

### Clinical Knowledge Ingestion
- Build PDF parsing pipeline | Roadmap `[x]` | Verified `FULL` | Evidence: `E37`
- Knowledge ingestion with chunking and embeddings | Roadmap `[x]` | Verified `FULL` | Evidence: `E38`
- Import drug formulary data | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E39`, `E42` | Lookup/import APIs exist; no built-in authoritative corpus preload found.
- Add ICD-10 and CPT lookups | Roadmap `[x]` | Verified `FULL` | Evidence: `E39`, `E40`, `E41`
- Knowledge context injection into responses | Roadmap `[x]` | Verified `FULL` | Evidence: `E59`
- Ingest orthopedic textbook content | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `E38` | No licensed textbook corpus in repo.
- Parse surgical technique guides | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `E38` | No dedicated guide parser/content bundle in repo.

### Imaging Integration
- DICOM viewer integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E46`
- Anatomical landmark annotation tools | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E44`, `E46`, `E64`, `E65`
- Side-by-side comparison | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E44`, `E45`, `E67`
- Measurement tools (angles/distances/alignment) | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E44`, `E46`
- Common finding templates | Roadmap `[x]` | Verified `FULL` | Evidence: `E44`, `E45`, `E66`
- Imaging study management (CRUD) | Roadmap `[x]` | Verified `FULL` | Evidence: `E44`, `E62`, `E63`, `E68`
- Imaging annotations storage | Roadmap `[x]` | Verified `FULL` | Evidence: `E44`, `E45`, `E64`, `E65`

### Enhanced Clinical Retrieval
- Hybrid search semantic + keyword fusion | Roadmap `[x]` | Verified `FULL` | Evidence: `E16`, `E38`
- Filter by subspecialty | Roadmap `[x]` | Verified `FULL` | Evidence: `E38`
- Filter by diagnosis tags | Roadmap `[x]` | Verified `FULL` | Evidence: `E38`
- Condition-aware retrieval | Roadmap `[ ]` | Verified `FULL` | Evidence: `E69`, `E70`, `E59`
- Protocol versioning | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E56` | Guideline version tracking exists; generalized protocol versioning not implemented.

## Phase 4: Voice & Interaction
### Voice Infrastructure
- Persistent whisper.cpp server vs per-request spawn | Roadmap `[x]` | Verified `FULL` | Evidence: `E47`
- Persistent Piper worker vs per-request spawn | Roadmap `[x]` | Verified `FULL` | Evidence: `E48`
- Stream audio to STT instead of file I/O | Roadmap `[x]` | Verified `FULL` | Evidence: `E26`, `E50`
- Use in-memory pipes for TTS output | Roadmap `[x]` | Verified `FULL` | Evidence: `E48`, `E27`

### Audio Modernization
- Migrate ScriptProcessorNode to AudioWorklet | Roadmap `[x]` | Verified `FULL` | Evidence: `E49`
- Record directly in WAV format | Roadmap `[x]` | Verified `FULL` | Evidence: `E49`
- Adaptive silence detection thresholds | Roadmap `[x]` | Verified `FULL` | Evidence: `E50`
- User-configurable microphone sensitivity | Roadmap `[x]` | Verified `FULL` | Evidence: `E50`, `E11`

### Interaction Polish
- Mid-response interrupt handling | Roadmap `[x]` | Verified `FULL` | Evidence: `E50`, `app/lib/voice/useVoiceFlow.ts:169-199`
- Visual STT processing feedback | Roadmap `[x]` | Verified `FULL` | Evidence: `E51`
- Transcription confidence indicators | Roadmap `[x]` | Verified `FULL` | Evidence: `E26`, `E51`

## Phase 5: Clinical Knowledge Base
### Clinical Guidelines Integration
- AAOS CPG integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- AO Foundation integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- ACSM guidelines integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- PT protocol database integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- Surgical atlas integration | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`

### Evidence Integration
- PubMed E-utilities client | Roadmap `[x]` | Verified `FULL` | Evidence: `E53`
- Cochrane integration | Roadmap `[x]` | Verified `FULL` | Evidence: `E54`
- Parse/rank evidence by level | Roadmap `[x]` | Verified `FULL` | Evidence: `E55`, `E56`
- Link recommendations to evidence | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E59` | Evidence context is injected; explicit recommendation-to-evidence citation enforcement is prompt-level.

### Drug & Device Knowledge
- Orthopedic implant databases | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- Medication protocols | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- Injection techniques | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`
- DME/bracing recommendations | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E52`, `E56`

### Ingestion Pipeline
- Background job queue for content updates | Roadmap `[x]` | Verified `PARTIAL` | Evidence: `E56`, `E57`, `E58` | Queue exists; execution is manually triggered.
- Version tracking for guideline updates | Roadmap `[x]` | Verified `FULL` | Evidence: `E56`, `E58`
- Incremental sync for new evidence | Roadmap `[x]` | Verified `FULL` | Evidence: `E56` (`sync_cursor`)
- Storage quota management and cleanup policies | Roadmap `[x]` | Verified `FULL` | Evidence: `E56`, `E58`

## Phase 6: Clinical Decision Support
### Diagnostic Workup Assistant
- Symptom-to-diagnosis flowcharts (interactive) | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E71`, `E72`, `E73` | Structured flowchart nodes/edges are generated and exposed via API; dedicated interactive graph UI is limited.
- Physical exam guidance with expected findings | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E73`
- Red flag detection and alerts | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`
- Differential diagnosis ranking with likelihood | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`
- Recommended workup based on presentation | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`

### Treatment Planning Tools
- Conservative vs surgical decision trees | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`
- Surgical approach comparison tool | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E71`, `E72`, `E73` | Comparison output is available in APIs; dedicated side-by-side planning UI is limited.
- Preoperative checklist generation | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`
- Recovery timeline visualization | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E71`, `E72` | Timeline milestones are generated; charted visualization is limited.
- Complication risk stratification tool | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`

### Outcome Prediction
- Functional calculators (WOMAC/KOOS/ODI) | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`
- Surgical outcome probability | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`
- Return-to-work/sport estimates | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E72`, `E75`
- Comparative effectiveness visualization | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E71`, `E72` | Comparative effectiveness outputs are generated; dedicated visualization is limited.

### Clinical Dashboards
- Patient overview with key metrics | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E74`, `E68`
- Treatment progress tracking | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E74`, `E68`
- Outcome measure trends | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E71`, `E74` | Trend extraction is implemented in dashboard payloads; dedicated trend charting in case UI is limited.
- Alerts for missed milestones/trends | Roadmap `[ ]` | Verified `FULL` | Evidence: `E71`, `E74`, `E68`

## Phase 7: Advanced AI
### Clinical Learning System
- Learn from case outcomes | Roadmap `[ ]` | Verified `FULL` | Evidence: `E76`, `E77`, `E78`, `E81`
- Cross-case pattern recognition | Roadmap `[ ]` | Verified `FULL` | Evidence: `E76`, `E77`
- Automatic A/B testing for diagnostic strategies | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E76`, `E77`, `E80` | Clinical experiment capture and analysis exists; automatic strategy assignment/rollout is still limited.
- User preference learning | Roadmap `[ ]` | Verified `FULL` | Evidence: `E76`, `E77`
- Feedback loop improves future recommendations | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E76`, `E79`, `E95` | Corrections and weight optimization are implemented; optimization triggers remain explicit/manual.

### Subspecialty Specialization
- Fine-tuning pipeline for subspecialty domains | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E79`, `E80`, `E81` | Subspecialty model registry/weights are implemented; model training pipeline is not in-repo.
- Evaluation harness with subspecialty benchmarks | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E79`, `E80`
- Model versioning and rollback | Roadmap `[ ]` | Verified `FULL` | Evidence: `E79`, `E80`
- Ensemble weight optimization by clinical task | Roadmap `[ ]` | Verified `FULL` | Evidence: `E79`, `E80`, `E95`

### DL Module Improvements
- Load vocabulary from config file | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `docs/audits/ROADMAP.md:268`
- Persist model in memory | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `docs/audits/ROADMAP.md:269`
- Batch embeddings for preprocessing | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `docs/audits/ROADMAP.md:270`
- Binary training-data transport | Roadmap `[ ]` | Verified `NOT BUILT` | Evidence: `docs/audits/ROADMAP.md:271`

## Phase 8: Production Hardening
### Lifecycle Management
- Shutdown registry for all singletons | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E82`, `E83`, `E47`, `E48` | System-wide registry exists and major services are registered; not every singleton is currently enrolled.
- Register SIGTERM/SIGINT cleanup handlers | Roadmap `[ ]` | Verified `FULL` | Evidence: `E82`, `E83`
- Graceful connection drain on shutdown | Roadmap `[ ]` | Verified `FULL` | Evidence: `E82`, `E84`, `E85`, `E86`
- Warm startup memory initialization | Roadmap `[ ]` | Verified `FULL` | Evidence: `E83`

### Error Handling
- Circuit breaker for LLM/embedding services | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E87`, `E18` | General LLM circuit breaker is implemented; embeddings still rely on memory-layer retry controls.
- Fallback when models unavailable | Roadmap `[ ]` | Verified `FULL` | Evidence: `E87`, `E86`
- User-friendly common failure messages | Roadmap `[ ]` | Verified `FULL` | Evidence: `E87`, `E84`, `E85`, `E86`
- Automatic retry with exponential backoff | Roadmap `[ ]` | Verified `FULL` | Evidence: `E87`, `E18`, `app/lib/memory/fetch.ts`

### Monitoring & Diagnostics
- Health check endpoint for all subsystems | Roadmap `[ ]` | Verified `FULL` | Evidence: `E88`, `E89`
- Performance dashboard (latency percentiles/throughput) | Roadmap `[ ]` | Verified `FULL` | Evidence: `E90`, `E91`, `E92`, `E93`
- Memory/CPU usage tracking | Roadmap `[ ]` | Verified `FULL` | Evidence: `E89`, `E90`, `E93`
- Log aggregation with structured formatting | Roadmap `[ ]` | Verified `PARTIAL` | Evidence: `E94` | Structured log formatting is implemented; external aggregation sinks are not configured in-repo.

## Notes
- Manual smoke verification remains pending in build docs: `docs/build/BUILD_DECISIONS.md:262-266` (`E60`).
- Imaging CRUD and annotation APIs are now wired (`E62`-`E65`), with case-page study management surfaced in UI (`E68`); advanced viewer UX remains partial (`E46`).
