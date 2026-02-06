# Improvements Log

## 2026-02-05
Phase: 1 (MVP - Clinical Intelligence Foundation)

Summary:
- Added bounded LLM request timeouts with a 10-20 minute clamp and a 15-minute default.
- Enforced RAG token budget in memory context assembly with a lightweight token estimator and trim logic.
- Fixed FTS query tokenization to preserve medical abbreviations and allow 2-character terms.
- Expanded clinical domain knowledge with explicit exam protocols and a compact anatomy quick map.
- Added a clinical reasoning benchmark and scoring rubric doc.
- Added an embedding load-test script and documented optional usage.

Changes:
- `app/lib/llm/config.ts`
- `app/api/llm/route.ts`
- `instrumentation.ts`
- `app/lib/memory/rag/index.ts`
- `app/lib/memory/rag/retrieval.ts`
- `app/lib/domain/domainKnowledge.ts`
- `docs/audits/CLINICAL_REASONING_BENCHMARK.md`
- `docs/STARTUP.md`
- `scripts/embedding-load-test.mjs`

Notes:
- Hardware validation for M4 llama.cpp configuration still requires a manual run on target hardware.

---

## 2026-02-05 (Phase 1 Review & Clinical Modes Completion)
Phase: 1 (MVP - Clinical Intelligence Foundation)

### Phase 1 Status Review

**Completed Items:**
- [x] Rebrand from Hacker Reign to OrthoAI (metadata, navigation, package naming)
- [x] Replace Ollama runtime with llama.cpp server
- [x] Configure BioMistral + BioGPT as primary models
- [x] Update database path to `.data/orthoai.db`
- [x] Add bounded timeouts (10-20 min default) for LLM requests
- [x] Replace mode definitions for orthopedic clinical contexts
- [x] Rewrite domain knowledge base with orthopedic terminology
- [x] Update context detection for clinical queries
- [x] Align base system prompt for clinical reasoning
- [x] Build clinical reasoning evaluation benchmark
- [x] Create scoring rubric for diagnostic accuracy and treatment appropriateness
- [x] Encode orthopedic examination protocols (ROM, special tests, grading systems)
- [x] Add anatomical knowledge base (bones, joints, ligaments, muscles, nerves)
- [x] Replace Ollama embeddings with OpenAI-compatible embeddings
- [x] Update Chroma collection naming for OrthoAI
- [x] Align summarization prompts for clinical context
- [x] Enforce `RAG_TOKEN_BUDGET` in prompt assembly
- [x] Implement token budget estimator with trim logic
- [x] Fix FTS query to preserve medical abbreviations (MRI, ACL, etc.)
- [x] Lower minimum FTS term length to 2 characters
- [x] Expose clinical modes in LeftToolbar
- [x] Update Chat component for clinical workflows
- [x] Align LearningDashboard for clinical domain modes

**Remaining Manual Tasks:**
- [ ] Validate llama.cpp server configuration on M4 hardware (requires target hardware)
- [ ] Confirm embedding endpoint performance under load (requires load testing)

### Clinical Modes Implementation

Added `treatment-decision` mode to complete the Phase 1 clinical modes requirement:

**All 7 Clinical Modes Now Available:**
1. **Clinical Consult** (`clinical-consult`) - Differential diagnosis, assessment, workup, next steps
2. **Treatment Decision** (`treatment-decision`) - Conservative vs surgical recommendations with rationale (NEW)
3. **Surgical Planning** (`surgical-planning`) - Operative approach, technique, implants, pitfalls
4. **Complications & Risk** (`complications-risk`) - Risk stratification and complication management
5. **Imaging Dx** (`imaging-dx`) - Imaging interpretation and next imaging steps
6. **Rehab / RTP** (`rehab-rtp`) - Rehabilitation progression and return-to-play criteria
7. **Evidence Brief** (`evidence-brief`) - Rapid evidence/guideline summary for decisions

**Treatment Decision Mode Features:**
- Conservative vs operative pathway framing with clear criteria
- Indications and contraindications for each treatment option
- Patient-specific factor weighting (age, activity, comorbidities, goals)
- Expected outcomes and timelines for each pathway
- Failure criteria and escalation pathways
- Shared decision-making points

Changes:
- `app/lib/domain/modeDefinitions.ts` - Added treatment-decision mode definition and suggestions
- `app/lib/domain/contextDetector.ts` - Added treatment-decision pattern detection
- `app/lib/strategy/context.ts` - Updated DetectionMode type
- `components/LeftToolbar.tsx` - Added treatment-decision to mode selector (desktop + mobile)

### Phase 1 Completion Summary

Phase 1 (MVP - Clinical Intelligence Foundation) is functionally complete. The remaining items are:
1. Hardware validation (M4 llama.cpp) - requires physical testing on target hardware
2. Embedding load testing - optional stress testing documented in `scripts/embedding-load-test.mjs`

All clinical modes, domain knowledge, RAG improvements, and UI updates specified in the roadmap are implemented and type-checked.

---

## 2026-02-05
Phase: 2 (Performance Optimization — Responsive Experience)

Summary:
- Lazy-loaded voice/3D stack via `VoicePanel` and gated audio context creation to reduce bundle and startup cost.
- Throttled audio level/frequency updates and auto-scroll, memoized markdown rendering, and added progressive message windowing.
- Reduced particle load on low-power devices and removed per-frame randomness with precomputed jitter.
- Removed RAG N+1 message lookups, trimmed Chroma query includes, and batched FTS message fetches.
- Added migration tracking, message query limits, embedding/summary queues, and code-identifier caching at ingest.
- Added semantic (embedding) similarity for ensemble voting and cached theme detection per conversation.
- Added simple-workflow bypass for low complexity and expanded parameter tuning buckets with weighted interpolation.
- Added lightweight metrics hooks for LLM, STT, TTS, and client render time; added debug flags for voice/metrics.

Changes:
- `components/Chat.tsx`
- `components/VoicePanel.tsx`
- `components/ParticleOrb.tsx`
- `app/lib/voice/useVoiceInput.ts`
- `app/lib/voice/useVoiceOutput.ts`
- `app/lib/voice/useVoiceFlow.ts`
- `app/lib/memory/rag/retrieval.ts`
- `app/lib/memory/rag/rerank.ts`
- `app/lib/memory/rag/embeddings.ts`
- `app/lib/memory/storage/sqlite.ts`
- `app/lib/memory/index.ts`
- `app/lib/memory/migrations/008_message_code_identifiers.sql`
- `app/lib/learning/patternRecognition.ts`
- `app/lib/learning/parameterTuner.ts`
- `app/lib/strategy/workflows/ensemble.ts`
- `app/lib/strategy/implementations/workflowStrategy.ts`
- `app/lib/strategy/context.ts`
- `app/lib/strategy/manager.ts`
- `app/lib/strategy/types.ts`
- `app/api/llm/route.ts`
- `app/api/stt/route.ts`
- `app/api/piper-tts/route.ts`
- `docs/STARTUP.md`

Notes:
- Message list “virtualization” is implemented as progressive windowing (load earlier messages on demand).
- New environment options: `EMBEDDING_CACHE_SIZE`, `DEBUG_METRICS`, `NEXT_PUBLIC_DEBUG_METRICS`, `NEXT_PUBLIC_DEBUG_VOICE`.

---

## 2026-02-05
Phase: 3 (MVP+ — Patient Cases & Clinical Knowledge)

Summary:
- Added patient case data model, timeline events, conversation links, and exportable summaries.
- Added case management UI (list, create, detail, timeline, link conversations).
- Implemented clinical knowledge ingestion with chunking, embeddings, and hybrid (semantic + FTS) search.
- Added knowledge management UI for ingesting and querying clinical text.

Changes:
- `app/lib/memory/migrations/009_case_system.sql`
- `app/lib/memory/migrations/010_knowledge_ingestion.sql`
- `app/lib/cases/types.ts`
- `app/lib/cases/index.ts`
- `app/api/cases/route.ts`
- `app/api/cases/[id]/route.ts`
- `app/api/cases/[id]/events/route.ts`
- `app/api/cases/[id]/link/route.ts`
- `app/api/cases/[id]/export/route.ts`
- `app/cases/page.tsx`
- `app/cases/[id]/page.tsx`
- `app/lib/knowledge/types.ts`
- `app/lib/knowledge/index.ts`
- `app/api/knowledge/route.ts`
- `app/api/knowledge/[id]/route.ts`
- `app/api/knowledge/search/route.ts`
- `app/knowledge/page.tsx`
- `components/TopNav.tsx`

Notes:
- Knowledge ingestion currently expects text input; PDF parsing and DICOM viewing are still pending.

---

## 2026-02-06
Phase: 3 (MVP+ — Patient Cases & Clinical Knowledge) - Continued Implementation

### Session Progress

**Completed in this session:**

1. ✅ **Patient Case UI Components** - Created reusable components:
   - `components/CaseList.tsx` - Case list with search, filtering (all/active/closed), selection support
   - `components/CaseForm.tsx` - Full create/edit form with demographics, complaints, history, medications, allergies, tags, delete functionality
   - `components/CaseTimeline.tsx` - Visual timeline with colored event types (injury, consultation, imaging, diagnosis, treatment, surgery, rehab, follow-up, outcome), add event form

2. ✅ **Enhanced Case Pages** - Updated existing pages to use new components:
   - `app/cases/page.tsx` - Now uses CaseList and CaseForm components
   - `app/cases/[id]/page.tsx` - Full case detail view with CaseForm, CaseTimeline, linked conversations, quick actions

3. ✅ **Case Context Selector in Chat** - Added patient case integration:
   - `components/LeftToolbar.tsx` - Added expandable case selector with case list, view case link, clear selection
   - `components/Chat.tsx` - Added `selectedCaseId` to settings, pass to LLM API, show "Case Context Active" indicator
   - `app/api/llm/route.ts` - Added case context injection (demographics, complaints, history, medications, allergies, tags, timeline events) into system prompt, auto-links conversations to cases

### Implementation Checklist - Phase 3 Remaining

**To Resume:** Reference the plan file at `~/.claude/plans/deep-squishing-hanrahan.md` or continue from this checklist.

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Patient Case UI components | ✅ Done | `components/CaseList.tsx`, `CaseForm.tsx`, `CaseTimeline.tsx` |
| 2 | Case management pages | ✅ Done | `app/cases/page.tsx`, `app/cases/[id]/page.tsx` |
| 3 | Case context selector in Chat | ✅ Done | `components/LeftToolbar.tsx`, `components/Chat.tsx`, `app/api/llm/route.ts` |
| 4 | PDF parsing pipeline | ⏳ Pending | Create `app/lib/knowledge/parsers/pdfParser.ts`, add `pdf-parse` dependency |
| 5 | Clinical codes migration | ⏳ Pending | Create `app/lib/memory/migrations/011_clinical_codes.sql` |
| 6 | CodeLookupManager | ⏳ Pending | Create `app/lib/codes/types.ts`, `app/lib/codes/index.ts` |
| 7 | Code lookup API routes | ⏳ Pending | Create `app/api/codes/icd10/route.ts`, `cpt/route.ts`, `drugs/route.ts` |
| 8 | DICOM imaging migration | ⏳ Pending | Create `app/lib/memory/migrations/012_imaging_system.sql` |
| 9 | ImagingManager | ⏳ Pending | Create `app/lib/imaging/types.ts`, `app/lib/imaging/index.ts` |
| 10 | DicomViewer component | ⏳ Pending | Create `components/DicomViewer.tsx`, add cornerstone.js dependencies |
| 11 | Knowledge context injection | ⏳ Pending | Update `app/api/llm/route.ts` to inject knowledge RAG results |
| 12 | Update ROADMAP.md | ⏳ Pending | Mark Phase 3 items complete |

### Next Steps (Priority Order)

1. **PDF Parsing Pipeline**
   ```bash
   npm install pdf-parse
   ```
   - Create `app/lib/knowledge/parsers/types.ts` - Parser interfaces
   - Create `app/lib/knowledge/parsers/pdfParser.ts` - PDF text extraction with chunking
   - Create `app/api/knowledge/upload/route.ts` - File upload endpoint

2. **Clinical Codes System**
   - Create migration `011_clinical_codes.sql` with tables: `drug_formulary`, `icd10_codes`, `cpt_codes` + FTS indexes
   - Create `CodeLookupManager` for searching codes
   - Create API routes for ICD-10, CPT, drug lookups

3. **DICOM Imaging**
   ```bash
   npm install cornerstone-core cornerstone-tools cornerstone-wado-image-loader dicom-parser
   ```
   - Create migration `012_imaging_system.sql` with tables: `imaging_studies`, `imaging_annotations`, `finding_templates`
   - Create `ImagingManager` for CRUD operations
   - Create `DicomViewer.tsx` with cornerstone.js integration

### Files Modified This Session

- `components/CaseList.tsx` (created)
- `components/CaseForm.tsx` (created)
- `components/CaseTimeline.tsx` (created)
- `components/LeftToolbar.tsx` (added case selector)
- `components/Chat.tsx` (added selectedCaseId, case context indicator)
- `app/cases/page.tsx` (refactored to use new components)
- `app/cases/[id]/page.tsx` (refactored to use new components)
- `app/api/llm/route.ts` (added case context injection)

---

## 2026-02-06
Phase: 3 (MVP+ — Patient Cases & Clinical Knowledge) - Completion

Summary:
- Completed PDF parsing pipeline for clinical document ingestion.
- Added clinical codes system with ICD-10, CPT, and drug formulary tables.
- Added DICOM imaging system with study management, annotations, and finding templates.
- Added knowledge context injection to LLM route for evidence-based responses.
- Created DicomViewer component with cornerstone.js integration.

### PDF Parsing Pipeline

- `app/lib/knowledge/parsers/types.ts` - Parser interface definitions
- `app/lib/knowledge/parsers/pdfParser.ts` - PDF text extraction using pdf-parse
- `app/api/knowledge/upload/route.ts` - File upload endpoint for PDF/text ingestion

### Clinical Codes System

- `app/lib/memory/migrations/011_clinical_codes.sql` - ICD-10, CPT, drug tables with FTS indexes
- `app/lib/codes/types.ts` - Type definitions for codes and drugs
- `app/lib/codes/index.ts` - CodeLookupManager with search and bulk import
- `app/api/codes/icd10/route.ts` - ICD-10 search and import API
- `app/api/codes/cpt/route.ts` - CPT code search and import API
- `app/api/codes/drugs/route.ts` - Drug formulary search and import API

### DICOM Imaging System

- `app/lib/memory/migrations/012_imaging_system.sql` - Imaging studies, annotations, templates, comparisons
- `app/lib/imaging/types.ts` - Type definitions for studies, annotations, templates
- `app/lib/imaging/index.ts` - ImagingManager with CRUD operations
- `components/DicomViewer.tsx` - DICOM viewer with cornerstone.js, measurement tools, window/level

### Knowledge Context Injection

- `app/api/llm/route.ts` - Added knowledge RAG search to inject relevant clinical knowledge into system prompt

### Dependencies Added

- `pdf-parse` - PDF text extraction
- `@cornerstonejs/core` - DICOM image rendering
- `@cornerstonejs/tools` - DICOM annotation tools
- `dicom-parser` - DICOM file parsing

### Phase 3 Status: COMPLETE

All core Phase 3 features implemented:
- ✅ Patient case management with UI components
- ✅ Case context injection for conversations
- ✅ PDF parsing for knowledge ingestion
- ✅ Clinical codes (ICD-10, CPT, drugs)
- ✅ DICOM imaging viewer with annotations
- ✅ Knowledge context injection for LLM
- ✅ Hybrid search (semantic + FTS)
- ✅ Subspecialty and diagnosis tag filtering

Remaining items marked as future enhancements:
- Content ingestion (textbooks, surgical guides) - requires licensed content
- Condition-aware retrieval - future enhancement
- Protocol versioning - future enhancement
