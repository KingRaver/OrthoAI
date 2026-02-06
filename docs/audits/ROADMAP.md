# OrthoAI Development Roadmap

**Document Version:** 1.0
**Date:** 2026-02-05
**Status:** Active Development

A phased roadmap for building OrthoAI—an orthopedic doctor in your computer—powered by specialized biomedical models running locally on Apple Silicon.

---

## Vision Statement

OrthoAI is a privacy-first, offline-capable clinical intelligence assistant that provides the equivalent of having an orthopedic specialist available 24/7. It offers diagnostic reasoning, treatment recommendations, imaging interpretation guidance, surgical planning support, and rehabilitation protocols—all running locally with complete patient data privacy.

---

## Design Principles

- [ ] **Local-first, offline-capable** — All core functionality works without internet
- [ ] **No in-code guardrails** — Clinical tool without embedded disclaimers or artificial limitations
- [ ] **Analytics-driven iteration** — Continuous model and strategy improvement via usage data
- [ ] **Privacy by design** — Patient data never leaves the device (HIPAA-compatible architecture)
- [ ] **Biomedical specialization** — BioMistral + BioGPT models tuned for orthopedic domain
- [ ] **Clinical reasoning first** — Mimics orthopedic specialist thought process, not literature search

---

## Phase 1: MVP — Clinical Intelligence Foundation

**Objective:** Stable, functional clinical chat that reasons like an orthopedic specialist.

### Core Infrastructure
- [x] Rebrand from Hacker Reign to OrthoAI (metadata, navigation, package naming)
- [x] Replace Ollama runtime with llama.cpp server
- [x] Configure BioMistral + BioGPT as primary models
- [x] Update database path to `.data/orthoai.db`
- [ ] Validate llama.cpp server configuration on M4 hardware
- [ ] Confirm embedding endpoint performance under load
- [x] Add bounded timeouts (10-20 min default) for LLM requests

### Clinical Domain System
- [x] Replace mode definitions for orthopedic clinical contexts
- [x] Rewrite domain knowledge base with orthopedic terminology
- [x] Update context detection for clinical queries
- [x] Align base system prompt for clinical reasoning
- [x] Build clinical reasoning evaluation benchmark
- [x] Create scoring rubric for diagnostic accuracy and treatment appropriateness
- [x] Encode orthopedic examination protocols (ROM, special tests, grading systems)
- [x] Add anatomical knowledge base (bones, joints, ligaments, muscles, nerves)

### Clinical Modes
- [x] **Diagnostic Mode** — Differential diagnosis from symptoms and exam findings (`clinical-consult`)
- [x] **Treatment Mode** — Conservative vs surgical recommendations with rationale (`treatment-decision`)
- [x] **Imaging Mode** — What to order, what to look for, interpretation guidance (`imaging-dx`)
- [x] **Surgical Mode** — Procedure selection, approach options, expected outcomes (`surgical-planning`)
- [x] **Rehab Mode** — Post-injury/post-op protocols, return-to-activity criteria (`rehab-rtp`)

### Memory & RAG Foundation
- [x] Replace Ollama embeddings with OpenAI-compatible embeddings
- [x] Update Chroma collection naming for OrthoAI
- [x] Align summarization prompts for clinical context
- [x] Enforce `RAG_TOKEN_BUDGET` in prompt assembly
- [x] Implement token budget estimator with trim logic
- [x] Fix FTS query to preserve medical abbreviations (MRI, ACL, etc.)
- [x] Lower minimum FTS term length to 2 characters

### User Interface
- [x] Expose clinical modes in LeftToolbar
- [x] Update Chat component for clinical workflows
- [x] Align LearningDashboard for clinical domain modes

---

## Phase 2: Performance Optimization — Responsive Experience ✅

**Objective:** Eliminate latency bottlenecks and reduce resource consumption.

### Client Performance
- [x] Lazy-load voice and 3D modules (dynamic import)
- [x] Gate AudioContext creation until voice mode enabled
- [x] Throttle audio level updates to 10-20 fps (use refs, not state)
- [x] Virtualize message list for long conversations
- [x] Memoize ReactMarkdown rendering per message ID
- [x] Throttle scroll-to-bottom with requestAnimationFrame
- [x] Reduce particle count on low-power devices
- [x] Precompute particle jitter values (avoid per-frame Math.random)

### RAG Pipeline
- [x] Remove N+1 SQLite lookups (batch with `IN` clause)
- [x] Remove 'embeddings' from Chroma query includes
- [x] Add `limit` and `order` parameters to `getConversationMessages`
- [x] Cache extracted code identifiers at message ingest
- [x] Implement connection pooling for Chroma client

### Memory System
- [x] Track applied migrations (avoid FTS backfill on every boot)
- [x] Use `PRAGMA user_version` or `schema_migrations` table
- [x] Cap concurrent embedding/summary work with in-process queue
- [x] Move summary generation to background job (fire-and-forget)
- [x] Make embedding cache size configurable via environment variable
- [x] Implement true LRU with access-time tracking

### Strategy & Orchestration
- [x] Replace Jaccard with semantic (cosine) similarity in ensemble voting
- [x] Cache theme detection results per conversation (30s TTL)
- [x] Add complexity threshold to bypass combined workflow (< 30)
- [x] Increase parameter tuner buckets from 3 to 10
- [x] Implement weighted interpolation for sparse profile buckets

### Observability
- [x] Gate verbose console.log behind DEBUG_* flags
- [x] Add metrics: client render time, LLM latency, embedding queue depth
- [x] Track STT/TTS end-to-end duration

---

## Phase 3: MVP+ — Patient Cases & Clinical Knowledge ✅

**Objective:** Enable patient case management and clinical knowledge ingestion.

### Patient Case System
- [x] Patient case data model (demographics, history, complaints, imaging, labs)
- [x] Case creation and editing interface
- [x] Case timeline view (injury → diagnosis → treatment → outcomes)
- [x] Link cases to conversations for context continuity
- [x] Export case summaries (for referrals, documentation)
- [x] Case context injection into LLM system prompt

### Clinical Knowledge Ingestion
- [x] Build PDF parsing pipeline for clinical guidelines and protocols
- [x] Knowledge document ingestion with chunking and embeddings
- [x] Import drug formulary data (dosing, contraindications, interactions)
- [x] Add ICD-10 and CPT code lookups
- [x] Knowledge context injection into LLM responses
- [ ] Ingest orthopedic textbook content — *requires licensed content*
- [ ] Parse surgical technique guides — *requires content*

### Imaging Integration
- [x] DICOM viewer integration (view X-rays, MRIs, CTs)
- [x] Anatomical landmark annotation tools
- [x] Side-by-side comparison (pre/post, left/right)
- [x] Measurement tools (angles, distances, alignment)
- [x] Common finding templates (fracture classification, arthritis grading)
- [x] Imaging study management (CRUD operations)
- [x] Imaging annotations storage

### Enhanced Clinical Retrieval
- [x] Hybrid search: semantic + keyword (FTS) fusion
- [x] Filter by subspecialty (spine, sports, trauma, arthroplasty, pediatric)
- [x] Filter by diagnosis tags
- [ ] Condition-aware retrieval — *future enhancement*
- [ ] Protocol versioning — *future enhancement*

---

## Phase 4: Voice & Interaction — Hands-Free Research

**Objective:** Enable voice-first interaction for clinical and research workflows.

### Voice Infrastructure
- [ ] Replace per-request STT process spawn with persistent whisper.cpp server
- [ ] Replace per-request TTS spawn with persistent Piper worker
- [ ] Stream audio to STT instead of file I/O
- [ ] Use in-memory pipes for TTS output

### Audio Modernization
- [ ] Migrate from ScriptProcessorNode to AudioWorklet
- [ ] Record directly in WAV format (bypass WebM conversion)
- [ ] Implement adaptive silence detection thresholds
- [ ] Add user-configurable microphone sensitivity

### Interaction Polish
- [ ] Interrupt handling for mid-response voice commands
- [ ] Visual feedback during STT processing
- [ ] Confidence indicators for transcription quality

---

## Phase 5: Clinical Knowledge Base — Guidelines & Evidence

**Objective:** Integrate authoritative clinical guidelines and evidence-based protocols.

### Clinical Guidelines Integration
- [ ] AAOS Clinical Practice Guidelines (orthopedic-specific)
- [ ] AO Foundation fracture classification and treatment
- [ ] ACSM exercise prescription guidelines
- [ ] Physical therapy protocol databases
- [ ] Surgical approach atlases

### Evidence Integration (Optional Research Mode)
- [ ] PubMed E-utilities API client for literature lookup
- [ ] Cochrane systematic review integration
- [ ] Parse and rank evidence by level (RCT, cohort, case series)
- [ ] Link treatment recommendations to supporting evidence

### Drug & Device Knowledge
- [ ] Orthopedic implant databases (hip, knee, shoulder systems)
- [ ] Medication protocols (NSAIDs, opioids, antibiotics, anticoagulation)
- [ ] Injection techniques (corticosteroid, viscosupplementation, PRP)
- [ ] DME and bracing recommendations

### Ingestion Pipeline
- [ ] Background job queue for content updates
- [ ] Version tracking for guideline updates
- [ ] Incremental sync for new evidence
- [ ] Storage quota management and cleanup policies

---

## Phase 6: Clinical Decision Support — Diagnosis & Treatment Planning

**Objective:** Structured clinical decision support tools beyond chat.

### Diagnostic Workup Assistant
- [ ] Symptom-to-diagnosis flowcharts (interactive)
- [ ] Physical exam guidance with expected findings
- [ ] Red flag detection and alerts
- [ ] Differential diagnosis ranking with likelihood
- [ ] Recommended workup based on presentation

### Treatment Planning Tools
- [ ] Conservative vs surgical decision trees
- [ ] Surgical approach comparison (pros/cons/outcomes)
- [ ] Preoperative checklist generation
- [ ] Expected recovery timeline visualization
- [ ] Complication risk stratification

### Outcome Prediction
- [ ] Functional outcome calculators (WOMAC, KOOS, ODI, etc.)
- [ ] Surgical outcome probability based on patient factors
- [ ] Return-to-work/sport timeline estimates
- [ ] Comparative effectiveness visualization

### Clinical Dashboards
- [ ] Patient overview with key metrics
- [ ] Treatment progress tracking
- [ ] Outcome measure trends over time
- [ ] Alerts for missed milestones or concerning trends

---

## Phase 7: Advanced AI — Clinical Learning & Subspecialization

**Objective:** Continuous improvement through clinical patterns and feedback.

### Clinical Learning System
- [ ] Learn from case outcomes (what worked, what didn't)
- [ ] Cross-case pattern recognition (similar presentations)
- [ ] Automatic A/B testing for diagnostic strategies
- [ ] User preference learning (treatment philosophy, aggression level)
- [ ] Feedback loop: user corrections improve future recommendations

### Subspecialty Specialization
- [ ] Fine-tuning pipeline for subspecialty domains:
  - Spine (cervical, lumbar, deformity)
  - Sports medicine (ACL, rotator cuff, cartilage)
  - Trauma (fracture care, polytrauma)
  - Arthroplasty (hip, knee, shoulder replacement)
  - Hand/upper extremity
  - Foot/ankle
  - Pediatric orthopedics
  - Oncology
- [ ] Evaluation harness with subspecialty-specific benchmarks
- [ ] Model versioning and rollback capability
- [ ] Ensemble weight optimization based on clinical task

### DL Module Improvements
- [ ] Load vocabulary from config file (expand beyond 9 tokens)
- [ ] Persist model in memory (avoid per-prediction loading)
- [ ] Batch embeddings for dataset preprocessing
- [ ] Switch to binary format for training data transport

---

## Phase 8: Production Hardening — Reliability & Maintenance

**Objective:** Ensure long-term stability and graceful operation.

### Lifecycle Management
- [ ] Implement shutdown registry for all singletons
- [ ] Register cleanup handlers for SIGTERM/SIGINT
- [ ] Graceful connection drain on shutdown
- [ ] Warm startup: initialize memory system at app start

### Error Handling
- [ ] Circuit breaker for LLM/embedding services
- [ ] Fallback strategies when models unavailable
- [ ] User-friendly error messages for common failures
- [ ] Automatic retry with exponential backoff

### Monitoring & Diagnostics
- [ ] Health check endpoint for all subsystems
- [ ] Performance dashboard (latency percentiles, throughput)
- [ ] Memory and CPU usage tracking
- [ ] Log aggregation with structured formatting

---

## Success Metrics

### Performance Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Client JS bundle (gzipped) | < 500KB | Build analysis |
| Hydration time | < 100ms | Performance.mark() |
| LLM latency P95 (simple query) | < 15s | API timing |
| LLM latency P95 (complex case) | < 60s | API timing |
| RAG retrieval P95 | < 200ms | Retrieval metrics |
| STT latency (10s audio) | < 3s | API timing |
| TTS latency (200 chars) | < 2s | API timing |
| Memory usage (idle) | < 512MB | Process metrics |
| Memory usage (load) | < 2GB | Process metrics |

### Clinical Quality Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Diagnostic accuracy (top-3 differential) | > 85% | Case benchmark |
| Treatment appropriateness | > 90% | Expert review |
| Red flag detection rate | > 95% | Safety audit |
| Anatomical accuracy | > 95% | Knowledge test |
| Guideline concordance | > 90% | Protocol alignment |
| Imaging interpretation accuracy | > 80% | Radiology benchmark |
| Surgical indication appropriateness | > 90% | Expert panel review |

---

## Key File References

### Domain & Prompts
- `app/lib/domain/modeDefinitions.ts`
- `app/lib/domain/domainKnowledge.ts`
- `app/lib/domain/contextDetector.ts`
- `app/lib/domain/contextBuilder.ts`

### LLM & Strategy
- `app/lib/llm/config.ts`
- `app/api/llm/route.ts`
- `app/lib/strategy/orchestrator.ts`
- `app/lib/strategy/workflows/chain.ts`
- `app/lib/strategy/workflows/ensemble.ts`

### Memory & RAG
- `app/lib/memory/index.ts`
- `app/lib/memory/storage/sqlite.ts`
- `app/lib/memory/rag/retrieval.ts`
- `app/lib/memory/rag/embeddings.ts`

### Voice
- `app/api/stt/route.ts`
- `app/api/piper-tts/route.ts`
- `app/lib/voice/audioRecorder.ts`
- `app/lib/voice/useVoiceInput.ts`

### UI Components
- `components/Chat.tsx`
- `components/ParticleOrb.tsx`
- `components/LeftToolbar.tsx`
- `components/LearningDashboard.tsx`
- `components/DicomViewer.tsx`
- `components/CaseList.tsx`
- `components/CaseForm.tsx`
- `components/CaseTimeline.tsx`

### Patient Cases & Knowledge
- `app/lib/cases/types.ts`
- `app/lib/cases/index.ts`
- `app/lib/knowledge/types.ts`
- `app/lib/knowledge/index.ts`
- `app/lib/knowledge/parsers/pdfParser.ts`
- `app/lib/codes/types.ts`
- `app/lib/codes/index.ts`
- `app/lib/imaging/types.ts`
- `app/lib/imaging/index.ts`

---

## Invariants (Do Not Change)

1. **No in-code medical disclaimers** — Clinical intelligence tool without artificial guardrails
2. **Local-first architecture** — All core features work offline
3. **Analytics retained** — Usage data drives model and clinical reasoning iteration
4. **Privacy preserved** — Patient data never leaves the device
5. **M4 optimized** — Primary target is Apple Silicon hardware
6. **Clinical reasoning focus** — Thinks like a specialist, not a search engine

---

*Last updated: 2026-02-06*
