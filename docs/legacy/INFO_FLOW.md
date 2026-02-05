Hacker Reign processes information through interconnected systems like strategy selection, domain context, memory RAG, and LLM orchestration, as detailed in the project documentation.

## Overall Flow
User input enters via chat or voice, triggering context analysis for mode, domain, and complexity. Strategy system selects optimal LLM model and workflow, augmented by RAG retrieval from memory.

Memory retrieves similar past conversations using embeddings and vector search before LLM inference.

## Detailed Granular Flowchart

```mermaid
graph TB
    UI[User Input Chat Voice] --> MS[MemoryManager]
    UI --> CD[Context Detector]
    
    MS --> ST["SQLite Storage<br/>hackerreign.db"]
    MS --> EM["Ollama Embeddings<br/>nomic-embed-text"]
    EM --> RE["ChromaDB Retrieval<br/>Top 5 Cosine 0.7"]
    RE --> CB[Context Builder]
    
    CD --> MD["Mode Detection<br/>Learning Review Expert"]
    CD --> DK["Domain Knowledge<br/>Python React Next.js"]
    MD --> CB
    DK --> CB
    
    CB --> CTX[Request Context]
    CTX --> SM[Strategy Manager]
    SM --> SR["Strategies<br/>Speed Quality Adaptive"]
    SR --> WO["Workflows<br/>Chain Ensemble"]
    WO --> RM["Resource Monitor<br/>RAM CPU GPU"]
    
    CTX --> AT["Analytics Tracker<br/>strategyanalytics.db"]
    WO --> INF["Ollama LLM Inference<br/>Multi-Model Tools"]
    CB --> INF
    RE --> INF
    
    INF --> MS
    INF --> OUT["Response Output<br/>Chat TTS Viz"]
    OUT --> FB["Feedback API"]
    
    FB --> PR["Pattern Recognition<br/>learningpatterns.db"]
    FB --> PT["Parameter Tuner<br/>parametertuning.db"]
    FB --> QP["Quality Predictor<br/>qualitypredictions.db"]
    
    PR --> SM
    PT --> SM
    QP --> SM
    PR --> LD["Learning Dashboard"]
    PT --> LD
    QP --> LD
    AT --> PR
    
    classDef core fill:#e3f2fd
    classDef db fill:#f3e5f5
    class MS,ST,EM,RE,CD,MD,DK,CB,CTX,SM,SR,WO,RM,AT,INF,FB,PR,PT,QP,LD core
    class ST,AT,PR,PT,QP db
```

## Memory System Breakdown
- **SQLite (hackerreign.db)**: Persistent conversations/messages with schema migrations.
- **ChromaDB (.data/chroma)**: Vector store for semantic search.
- **Embeddings**: Ollama nomic-embed-text (384-dim), generated on save.
- **Retrieval**: Cosine similarity, top-5, threshold 0.7, metadata filtering.

## Domain Selection Mechanics
- **Detection Signals**: Keywords ('explain'), file extensions (.py/.tsx), code patterns (async/hooks).
- **Modes**: Learning (patient, examples), Code-Review (critical fixes), Expert (trade-offs).
- **Dynamic Params**: Temp 0.3-0.5, tokens 6k-8k per mode.

## Context Building Process
Merges: Mode instructions + Domain knowledge (e.g., asyncio patterns) + RAG history → single enriched system prompt for LLM.

## Continual Learning Components
- **PatternRecognition**: Tracks mode+domain+model → success rate in learningpatterns.db.
- **ParameterTuner**: A/B tests temp/top-p/maxTokens → parametertuning.db.
- **QualityPredictor**: ML pre-gen score (0-100) → qualitypredictions.db, influences routing.
- **Feedback Loop**: api/feedback → all systems + LearningDashboard visualization.
