# OrthoAI

Local-first orthopedic clinical intelligence for clinicians. OrthoAI is optimized for clinical consults, surgical planning, complications/risk, imaging dx, rehab/RTP, and evidence briefs with persistent memory and RAG.

## Core Capabilities
- **Evidence Synthesis**: compare studies, outcomes, and cohorts with structured summaries
- **Mechanistic Reasoning**: biomechanics + tissue biology analysis
- **Hypothesis Builder**: generate testable hypotheses and predictions
- **Study Design**: outline protocols, endpoints, and controls
- **RAG + Memory**: long-term conversation memory with ChromaDB
- **Feedback Loop**: analytics to improve model selection over time

## Runtime (llama.cpp)
OrthoAI uses an OpenAI-compatible local server (llama.cpp) for inference.

**Environment variables**
- `LLM_BASE_URL` (default `http://localhost:8080/v1`)
- `LLM_DEFAULT_MODEL` (default `biomistral-7b-instruct`)
- `EMBEDDING_BASE_URL` (defaults to `LLM_BASE_URL`)
- `EMBEDDING_MODEL` (default `nomic-embed-text`)

## Models
Recommended starting set (Option A):
- **BioMistral 7B** (primary clinical decision support + surgical planning)
- **BioGPT** (fast extraction / compact answers)

## Development
```bash
npm install
npm run dev
```

## RAG / ChromaDB
If you want retrieval-augmented memory, start ChromaDB locally:
```bash
npm run chroma-start
```

## Notes
This repository is a refactored template focused on orthopedic research workflows. Some template docs may still reference legacy components and will be updated over time.
