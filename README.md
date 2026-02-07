# OrthoAI

Local-first orthopedic clinical intelligence for clinicians. OrthoAI provides attending-level decision support for orthopedic workflows including clinical consults, surgical planning, complications/risk assessment, imaging diagnosis, rehabilitation/return-to-play protocols, and evidence briefs.

Built with privacy-first principles using local LLM inference (llama.cpp) and persistent memory with RAG (ChromaDB + SQLite).

## Features

### Clinical Interaction Modes

OrthoAI automatically detects context and adapts to seven specialized workflows:

| Mode | Description |
|------|-------------|
| **Clinical Consult** | Attending-level assessment with specific diagnosis, treatment recommendations, and next steps |
| **Treatment Decision** | Conservative vs surgical decision support with named procedures and evidence-based criteria |
| **Surgical Planning** | Operative approach, technique, implant selection, and contingency planning |
| **Complications & Risk** | Risk stratification, prevention strategies, and complication management algorithms |
| **Imaging Dx** | Imaging interpretation with clinical correlation and next imaging recommendations |
| **Rehab / RTP** | Phase-based rehabilitation protocols with objective progression criteria |
| **Evidence Brief** | Rapid evidence and guideline summaries for clinical decision-making |

### Core Capabilities

- **Multi-Model Strategy System**: Intelligent model selection with ensemble voting, model chaining, and ML-driven quality prediction
- **RAG + Persistent Memory**: Long-term conversation memory with ChromaDB vector store and SQLite
- **Knowledge Base**: Ingest and retrieve orthopedic literature (PDF parsing, chunking, embeddings)
- **Patient Case Management**: Track cases with demographics, history, imaging, labs, and linked conversations
- **DICOM Viewer**: View and annotate medical imaging with Cornerstone.js integration
- **Medical Coding**: ICD-10, CPT code lookup, and drug reference database
- **Voice Interface**: Speech-to-text input and text-to-speech output
- **Learning System**: Quality prediction, pattern recognition, and parameter tuning based on feedback
- **Code Execution**: Sandboxed Python/JavaScript execution via Pyodide for calculations and analysis

## Architecture

```
OrthoAI/
├── app/
│   ├── api/              # Next.js API routes
│   │   ├── llm/          # LLM chat endpoint
│   │   ├── memory/       # Memory and consent APIs
│   │   ├── knowledge/    # Knowledge base APIs
│   │   ├── cases/        # Case management APIs
│   │   ├── codes/        # Medical coding APIs
│   │   ├── analytics/    # Usage analytics
│   │   └── ...
│   ├── lib/
│   │   ├── strategy/     # Multi-model orchestration
│   │   ├── domain/       # Mode detection and system prompts
│   │   ├── memory/       # SQLite + RAG memory system
│   │   ├── knowledge/    # Knowledge base and PDF parsing
│   │   ├── cases/        # Case management
│   │   ├── imaging/      # DICOM handling
│   │   ├── codes/        # ICD-10, CPT, drugs
│   │   ├── learning/     # ML-based quality prediction
│   │   ├── voice/        # Voice input/output
│   │   ├── tools/        # Calculator, code execution
│   │   └── llm/          # LLM configuration
│   └── pages/            # Next.js pages
├── components/           # React components
│   ├── Chat.tsx          # Main chat interface
│   ├── CaseForm.tsx      # Case management UI
│   ├── DicomViewer.tsx   # DICOM image viewer
│   ├── LearningDashboard.tsx  # Analytics dashboard
│   └── ...
└── .data/                # Local data storage
    ├── orthoai.db        # SQLite database
    └── chroma/           # ChromaDB vector store
```

## Prerequisites

- **Node.js** 18+
- **llama.cpp** (for local LLM inference)
- **Docker Desktop** (for ChromaDB)
- **Hugging Face account** (for model downloads)

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repo-url>
cd OrthoAI
npm install
```

### 2. Install llama.cpp

```bash
brew install llama.cpp
```

### 3. Start the LLM Server (BioMistral 7B)

```bash
llama-server \
  --hf-repo tensorblock/BioMistral-7B-GGUF \
  --hf-file BioMistral-7B-Q4_K_M.gguf \
  --alias biomistral-7b-instruct \
  --port 8080
```

Verify the server is running:
```bash
curl http://127.0.0.1:8080/v1/models
```

### 4. Start the Embedding Server (Nomic Embed)

```bash
llama-server \
  --hf-repo nomic-ai/nomic-embed-text-v1.5-GGUF \
  --hf-file nomic-embed-text-v1.5.Q5_K_M.gguf \
  --embedding \
  --alias nomic-embed-text \
  --port 8081
```

### 5. Configure Environment

Create `.env.local` in the project root:

```bash
# LLM Configuration
LLM_BASE_URL=http://127.0.0.1:8080/v1
LLM_DEFAULT_MODEL=biomistral-7b-instruct
EMBEDDING_BASE_URL=http://127.0.0.1:8081/v1
EMBEDDING_MODEL=nomic-embed-text

# Storage Configuration
MEMORY_DB_PATH=./.data/orthoai.db
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_DB_PATH=./.data/chroma
```

### 6. Start ChromaDB (Vector Store)

```bash
npm run chroma-start
```

### 7. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://localhost:8080/v1` | OpenAI-compatible LLM server URL |
| `LLM_DEFAULT_MODEL` | `biomistral-7b-instruct` | Default model for inference |
| `LLM_API_KEY` | `llama.cpp` | API key (if required) |
| `LLM_REQUEST_TIMEOUT_MS` | `900000` | Request timeout (10-20 min range) |
| `EMBEDDING_BASE_URL` | Same as `LLM_BASE_URL` | Embedding server URL |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model name |
| `MEMORY_DB_PATH` | `./.data/orthoai.db` | SQLite database path |
| `CHROMA_HOST` | `localhost` | ChromaDB host |
| `CHROMA_PORT` | `8000` | ChromaDB port |
| `DISABLE_RAM_CONSTRAINTS` | `false` | Disable RAM-based model downgrades |

### Recommended Models

**Primary (clinical decision support)**:
- BioMistral 7B (Q4_K_M or Q5_K_M quantization)

**Embeddings**:
- Nomic Embed Text v1.5

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run chroma-start` | Start ChromaDB container |
| `npm run chroma-stop` | Stop ChromaDB container |
| `npm run analyze` | Bundle size analysis |

## Key Modules

### Strategy System (`app/lib/strategy/`)
Multi-model orchestration with:
- **Workflow Strategy**: Combined ensemble + chain execution
- **Quality Prediction**: ML-based response quality forecasting
- **Parameter Tuning**: Automatic temperature/token optimization
- **A/B Testing**: Strategy experiment framework

### Memory System (`app/lib/memory/`)
Persistent conversation memory:
- **SQLite Storage**: Conversations, messages, summaries, user profiles
- **RAG Retrieval**: Semantic search via ChromaDB embeddings
- **Auto-Summarization**: Periodic conversation summaries for long-term recall
- **Profile Memory**: User preferences with explicit consent

### Domain Detection (`app/lib/domain/`)
Automatic context detection:
- Mode classification based on keywords and patterns
- Domain-specific system prompts
- Complexity scoring for model selection

### Knowledge Base (`app/lib/knowledge/`)
Literature management:
- PDF parsing and chunking
- Document metadata (subspecialty, diagnosis tags)
- Hybrid search (FTS + vector similarity)

### Learning System (`app/lib/learning/`)
Continuous improvement:
- Pattern recognition for successful interactions
- Quality prediction before generation
- Parameter optimization based on outcomes

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4
- **LLM**: llama.cpp (OpenAI-compatible API)
- **Vector Store**: ChromaDB
- **Database**: SQLite (better-sqlite3)
- **Imaging**: Cornerstone.js, dicom-parser
- **Math**: math.js
- **Code Execution**: Pyodide (Python in browser)
- **3D Rendering**: Three.js
- **Validation**: Zod

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/llm` | POST | Chat completions with streaming |
| `/api/memory/consent` | GET/POST | Memory consent management |
| `/api/memory/metrics` | GET | Memory system statistics |
| `/api/knowledge` | GET/POST | Knowledge base CRUD |
| `/api/cases` | GET/POST | Case management |
| `/api/codes` | GET | ICD-10/CPT code lookup |
| `/api/analytics` | GET/POST | Usage analytics |
| `/api/feedback` | POST | User feedback submission |
| `/api/profile` | GET/POST | User profile management |

## Privacy

OrthoAI is designed for local-first operation:
- All LLM inference runs locally via llama.cpp
- Data stored locally in SQLite and ChromaDB
- No external API calls for core functionality
- Explicit consent required for profile memory features

## License

See [LICENSE.md](LICENSE.md) for details.
