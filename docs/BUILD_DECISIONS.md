# OrthoAI Build Decisions

This document captures the agreed design decisions and scope for OrthoAI, plus expanded guidance on model selection, ingestion pipeline, and the RAG roadmap.

## 1) Purpose & Scope
- **Goal:** Local-first orthopedic research intelligence for clinicians and researchers.
- **Domain scope:** Orthopedics broadly (not limited to a single injury or joint).
- **Primary workflows:** Evidence synthesis, mechanistic reasoning, hypothesis generation, and study design.
- **No patient-facing guardrails in code:** No “not medical advice” or similar prompt/UI guardrails will be embedded in the system.
  - If any disclaimer is desired later, it should live **only in documentation**.

## 2) Users & Use Cases
- **Target users:** Researchers and clinicians.
- **Common tasks:**
  - Compare/contrast studies and outcomes
  - Mechanistic reasoning across biomechanics + tissue biology
  - Generate testable hypotheses
  - Draft study protocols and endpoints

## 3) Runtime & Deployment
- **LLM runtime:** `llama.cpp` using OpenAI‑compatible endpoints.
- **Default base URL:** `http://localhost:8080/v1`
- **Core config (env):**
  - `LLM_BASE_URL`
  - `LLM_DEFAULT_MODEL`
  - `EMBEDDING_BASE_URL`
  - `EMBEDDING_MODEL`

## 4) Model Strategy (Option A)
- **Primary model:** `biomistral-7b-instruct` (synthesis + reasoning)
- **Secondary model:** `biogpt` (fast extraction/compact output)
- **Rotation:** Modular architecture allows model swaps later without major refactor.

## 5) RAG Strategy
- **Embeddings:** OpenAI‑compatible `/v1/embeddings` endpoint.
- **Default embedding model:** `nomic-embed-text`.
- **Vector store:** ChromaDB (local).
- **No external data ingestion yet.**

## 6) External RAG Sources (Suggested, Not Implemented Yet)
- PubMed (NCBI E‑utilities)
- Europe PMC (full text + metadata)
- PMC OAI‑PMH (bulk OA harvesting)
- Crossref / OpenAlex / Semantic Scholar (metadata + citation graph)

## 7) Architecture Choice
- **Selective clone of Hacker Reign** into `/Users/jeffspirlock/OrthoAI`.
- **Kept:** UI, memory/RAG, analytics, strategy system, voice (optional).
- **Removed or disabled:** DL codegen injection and code‑centric prompts.

## 8) Interaction Modes (OrthoAI)
- **Evidence Synthesis** (`synthesis`)
- **Mechanistic Reasoning** (`mechanistic`)
- **Hypothesis Builder** (`hypothesis`)
- **Study Design** (`study-design`)

## 9) Research‑First UI Decisions
- Outputs should label **evidence vs hypothesis** clearly.
- Use structured summaries, tables, and limitations sections.
- Prioritize citations and dataset provenance.

## 10) Feedback Loop
- **Analytics retained** as the feedback system for iterative learning.
- Strategy + mode performance tracking remains enabled.

## 11) Repository & Source Control
- New Git repository initialized in `/Users/jeffspirlock/OrthoAI`.
- Package renamed to `orthoai`.

## 12) Open Questions (Future Decisions)
- Which external RAG sources to integrate first (PubMed vs Europe PMC vs OpenAlex)?
- What ingestion pipeline format for local PDFs/datasets?
- Should voice features remain enabled by default?
- Should we add a dedicated “Evidence Map” UI panel?

---

# Expanded Details

## A) Model Evaluation Rubric (Additive)
Use this rubric to compare candidate models before rotating them into OrthoAI.

**1. Domain Fidelity**
- Orthopedic terminology accuracy (anatomy, procedures, biomechanics, imaging)
- Correct use of outcome measures and study design language
- Consistent use of clinical vs mechanistic framing

**2. Instruction Following**
- Adheres to requested mode (synthesis vs mechanistic vs hypothesis vs study design)
- Produces structured outputs (tables, sections, comparisons)
- Complies with citation requirements

**3. Reasoning Quality**
- Causal pathway coherence (biomechanics → tissue response → outcome)
- Evidence vs hypothesis separation
- Can surface confounders, heterogeneity, and study limitations

**4. Citation Fidelity**
- Claims trace back to retrieved evidence
- Minimal hallucinated citations
- References appropriate study types (RCT, cohort, SR, etc.)

**5. Context & Recall**
- Handles long‑context prompts without drifting
- Integrates multiple papers without collapsing distinctions

**6. Latency & Resource Fit**
- Acceptable throughput on M4 16GB RAM
- Stable performance under long sessions

**7. Error Profiles**
- Common failure modes (over‑confident synthesis, wrong mechanistic pathways)
- Style drift when using tools or long multi‑turn contexts

**Scoring suggestion:** 1–5 per category, with thresholds for promotion into “primary” or “secondary.”

---

## B) Ingestion Pipeline Design (Additive)
This pipeline is designed for both external sources and local PDFs when you add them.

**1. Acquisition**
- Pull metadata + abstracts first (PubMed, OpenAlex, Crossref)
- Pull full text where legally available (Europe PMC OA, PMC OA)
- Support local corpus ingestion (PDFs, DOCX, CSV)

**2. Normalization**
- Convert into a canonical document schema:
  - `title`, `authors`, `year`, `journal`
  - `doi` / `pmid` / `pmcid`
  - `abstract`, `full_text`
  - `study_type`, `population`, `outcomes`
  - `source` and `license`

**3. Metadata Extraction (NLP pass)**
- Detect study type (RCT, cohort, SR, case series)
- Extract key populations (age, injury type, surgical vs conservative)
- Capture endpoints (PROMs, imaging markers, biomechanical metrics)

**4. Chunking Strategy**
- Chunk by semantic section (abstract, methods, results, discussion)
- Maintain section boundaries + metadata
- Default target chunk size: 600–1200 tokens

**5. Embeddings & Indexing**
- Generate embeddings for each chunk
- Store in Chroma with metadata filters (study type, year, tissue, joint, etc.)

**6. Provenance & Versioning**
- Keep source identifier and ingestion timestamp
- Track re‑ingestions and updates
- Deduplicate by DOI/PMID + hash

**7. Quality Checks**
- Reject or quarantine low‑quality OCR
- Flag missing sections or invalid metadata

---

## C) RAG Roadmap (Additive)
A phased plan to scale retrieval without breaking local workflow.

**Phase 0 — Manual Local Corpus**
- Upload PDFs locally
- Extract + chunk + embed
- Use in RAG with citations

**Phase 1 — PubMed Metadata Layer**
- Ingest abstracts + metadata only
- Allow filtered retrieval by injury, joint, tissue, study type

**Phase 2 — OA Full‑Text**
- Europe PMC / PMC OA ingestion for full text
- Weight OA full text higher in evidence synthesis

**Phase 3 — Citation Graphs**
- Pull references and citation counts (OpenAlex / Semantic Scholar)
- Build “evidence map” from citation network

**Phase 4 — Registry / Trials Layer**
- Integrate clinical trials registries (e.g., ClinicalTrials.gov)
- Associate ongoing trials with published evidence

**Phase 5 — Private Corpora**
- Local institutional datasets, internal protocols, or proprietary data
- Keep isolated per user/organization

---

## D) Immediate Next Steps
- Start llama.cpp server and set env vars.
- Start ChromaDB for RAG (`npm run chroma-start`).
- Decide initial corpus ingestion strategy (manual PDFs vs PubMed metadata).
