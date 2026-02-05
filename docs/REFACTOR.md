# OrthoAI Refactor Guide

This document captures the refactor journey from **Hacker Reign** to **OrthoAI**, including what changed, why it changed, and what remains to be done.

## 1) Starting Point
We started from the **Hacker Reign** template:
- Next.js 16 + React 19 app
- Local LLM integration (Ollama‑centric)
- Multi‑model orchestration + analytics
- RAG + memory system using ChromaDB
- Coding‑focused domain detection and prompts

## 2) Refactor Objectives
- Shift from coding assistant → **orthopedic research intelligence**
- Replace Ollama‑specific assumptions with **llama.cpp**
- Reduce model set to **2 specialized biomedical models**
- Preserve analytics and memory/RAG
- Build research‑specific modes and domain knowledge
- Avoid embedding “not medical advice” prompts/guardrails in code

## 3) What Has Been Refactored (Completed)
### A) Branding & Identity
- **App metadata:** `app/layout.tsx`
- **Navigation branding:** `components/TopNav.tsx`
- **Package naming:** `package.json`, `package-lock.json`
- **Top‑level README:** `README.md`

### B) Domain System (Orthopedic Research)
- **Mode definitions replaced:** `app/lib/domain/modeDefinitions.ts`
- **Domain knowledge replaced:** `app/lib/domain/domainKnowledge.ts`
- **Context detection rewritten:** `app/lib/domain/contextDetector.ts`
- **Base system prompt updated:** `app/lib/domain/contextBuilder.ts`

### C) LLM Runtime (llama.cpp)
- Added shared config helper: `app/lib/llm/config.ts`
- LLM API route now uses llama.cpp endpoints: `app/api/llm/route.ts`
- Removed Ollama‑specific options from streaming/non‑streaming calls

### D) Embeddings & RAG
- Replaced Ollama embeddings with OpenAI‑compatible embeddings:
  - `app/lib/memory/rag/embeddings.ts`
  - Updated imports in `app/lib/memory/rag/retrieval.ts` + `app/lib/memory/rag/index.ts`
- New Chroma collection naming for OrthoAI

### E) Models & Strategy System
- **Model list trimmed:** BioMistral + BioGPT
- Strategy defaults updated:
  - `app/lib/strategy/context.ts`
  - `app/lib/strategy/baseStrategy.ts`
  - `app/lib/strategy/implementations/*`
  - `app/lib/strategy/resources/constraints.ts`

### F) UI & Interaction Changes
- New modes exposed in UI:
  - `components/LeftToolbar.tsx`
  - `components/Chat.tsx`
  - `components/LearningDashboard.tsx`

### G) Memory System Updates
- Database path renamed to `.data/orthoai.db`
- Summarization prompt re‑aligned for research

### H) Analytics & Feedback
- Mode analytics updated to new modes
- Feedback route comments updated

## 4) What Has Been Explicitly Removed
- **DL codegen injection** from LLM route
- **Coding‑centric prompts and modes**
- **Ollama‑only dependencies in prompts/logic**

## 5) What Still Needs Work (Planned)
### Documentation
- Update remaining legacy docs (memory, strategy, voice, etc.) to OrthoAI context
- Add architecture + prompting + RAG pipeline docs

### RAG Ingestion Pipeline
- Build ingestion pipeline for PubMed/Europe PMC
- Define canonical schema + chunking strategy
- Add deduplication by DOI/PMID

### Evaluation
- Build a baseline “gold set” of orthopedic research prompts
- Create scoring rubric for hallucinations and citation fidelity

### UI Enhancements
- Evidence map view (citation graph + filters)
- Optional imaging‑specific output widgets

### Runtime
- Validate llama.cpp server config on M4
- Confirm embedding endpoint performance under load

## 6) Roadmap (High‑Level)
1. **MVP (Local Research Assistant)**
2. **MVP+ (Local PDF ingestion + citations)**
3. **RAG v1 (PubMed + OA full text)**
4. **RAG v2 (Citation graph + evidence map)**

## 7) Invariants (Do Not Change)
- No in‑code “not medical advice” guardrails
- Local‑first, offline‑capable design
- Analytics retained for model iteration

## 8) File Index (Key)
- `app/lib/domain/*` → domain detection + prompts
- `app/lib/llm/config.ts` → llama.cpp config
- `app/api/llm/route.ts` → LLM entrypoint
- `app/lib/memory/*` → memory + RAG
- `app/lib/strategy/*` → model routing + analytics
- `components/*` → UI interaction

