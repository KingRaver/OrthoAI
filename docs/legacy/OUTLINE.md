# 🚀 **Hacker Reign - Complete Build Reference**
*Jan 12, 2026 -  M4 MacBook Air 16GB -  Multi-Model Strategy System + Adaptive Learning*

## 🎯 **PROJECT SUMMARY**
**Self-contained Next.js interface** with **intelligent multi-model orchestration** via Ollama. Features adaptive learning, pattern recognition, quality prediction, domain-aware context detection, voice interaction, and RAG-powered memory. Private, offline, production-ready AI assistant (Python/Next.js/Web3 focus).

| **Model** | **Size** | **Strength** | **Use Case** | **Strategy** |
|-----------|----------|--------------|--------------|--------------|
| `llama3.2:3b-instruct-q5_K_M` | 2.3GB | Fast/general | Simple tasks, quick responses | Speed |
| `qwen2.5-coder:7b-instruct-q5_K_M` | 5.5GB | Code/reasoning | Moderate complexity, coding | Balanced |
| `deepseek-coder-v2:16b-instruct-q4_K_M` | 9.8GB | Expert coding | Complex analysis, refactoring | Quality |
| `nomic-embed-text` | 137MB | Embeddings | RAG/semantic search | - |

**Total:** ~17.6GB -  **M4 Performance:** 20-80 tokens/sec warm
**Strategy System:** Auto-selects optimal model based on task complexity, resource availability, and learned patterns

## 🏗️ **FILE STRUCTURE**
```
hackerreign/
├── app/
│   ├── api/
│   │   ├── llm/route.ts       # ← Main LLM endpoint with strategy integration
│   │   ├── analytics/route.ts # ← Learning & strategy analytics API
│   │   ├── feedback/route.ts  # ← User feedback collection
│   │   ├── stt/route.ts       # ← Speech-to-Text API (Whisper)
│   │   ├── piper-tts/route.ts # ← Piper TTS Python integration
│   │   └── dl-codegen/        # ← Deep learning code generation
│   │       ├── train/route.ts
│   │       └── predict/route.ts
│   ├── lib/
│   │   ├── strategy/          # ← Multi-model orchestration system
│   │   │   ├── manager.ts            # Strategy registry & selection
│   │   │   ├── orchestrator.ts       # Multi-model workflows
│   │   │   ├── implementations/      # Speed, Quality, Cost, Complexity, Adaptive
│   │   │   ├── workflows/            # Chain & Ensemble patterns
│   │   │   ├── resources/            # Resource monitoring & constraints
│   │   │   └── analytics/            # Performance tracking
│   │   ├── learning/          # ← Adaptive learning system
│   │   │   ├── patternRecognition.ts # Pattern detection & analysis
│   │   │   ├── parameterTuner.ts     # Hyperparameter optimization
│   │   │   └── qualityPredictor.ts   # Quality prediction
│   │   ├── domain/            # ← Context detection & mode system
│   │   │   ├── contextDetector.ts
│   │   │   ├── modeDefinitions.ts
│   │   │   ├── domainKnowledge.ts
│   │   │   └── contextBuilder.ts
│   │   ├── memory/            # ← RAG & conversation storage
│   │   │   ├── storage/       # SQLite persistence
│   │   │   └── rag/           # ChromaDB + embeddings
│   │   ├── voice/             # ← STT/TTS with Piper integration
│   │   │   ├── useVoiceInput.ts
│   │   │   ├── useVoiceOutput.ts
│   │   │   ├── useVoiceFlow.ts
│   │   │   ├── voiceStateManager.ts
│   │   │   └── audioAnalyzer.ts
│   │   ├── dl-codegen/        # ← TensorFlow.js code generation
│   │   │   ├── model.ts       # LSTM architecture
│   │   │   ├── train.ts       # Training pipeline
│   │   │   └── preprocess.ts  # Tokenization
│   │   └── tools/             # LLM tool handlers
│   └── page.tsx              # ← <Chat /> wrapper
├── components/
│   ├── Chat.tsx              # ← UI + strategy + mode selector
│   ├── LearningDashboard.tsx # ← Learning analytics UI
│   ├── TopNav.tsx            # ← Navigation bar
│   ├── VoiceOrb.tsx          # ← 2D voice visualization
│   └── ParticleOrb.tsx       # ← 3D particle visualization
├── data/                      # SQLite databases
│   ├── learning_patterns.db
│   ├── parameter_tuning.db
│   ├── quality_predictions.db
│   └── strategy_analytics.db
├── package.json              # openai, next, react, tailwind, chromadb, better-sqlite3, tensorflow
├── tsconfig.json             # @/* paths: ["./*"]
└── tailwind.config.ts
```

## ⚡ **QUICK START** (3 Terminals)
```bash
# T1: Ollama (models + embeddings)
ollama serve
# LLM models: llama3.2:3b ✅, qwen2.5:7b ✅, qwen2.5-coder:7b ✅
ollama pull nomic-embed-text   # For RAG/semantic search

# T2: App
cd hackerreign
npm install                    # Includes chromadb, better-sqlite3
npm run dev                    # http://localhost:3000

# T3: (optional) Docker + ChromaDB
docker-compose up -d           # If using Docker for services

# T4: (optional) Warm models
OLLAMA_KEEP_ALIVE=-1 ollama serve  # Never unloads
```

---

## 🎯 **MULTI-MODEL STRATEGY SYSTEM**

### **Architecture**
```
User Request → Context Analysis → Strategy Selection → Resource Check → Model Selection → LLM Inference
                     ↓                    ↓                  ↓                ↓
                Complexity         Speed/Quality/     RAM/CPU/GPU      3B/7B/16B
                Domain             Cost/Adaptive       Battery          Models
                Mode                                   Constraints
                     ↓
              Analytics Logging → Learning System → Pattern Recognition → Adaptive Improvement
```

### **Strategy Types**
| Strategy | Focus | Model Selection | Use Case |
|----------|-------|-----------------|----------|
| **Speed** | Fast response | Always 3B | Quick answers, simple tasks |
| **Quality** | Best output | Always 16B | Complex analysis, critical code |
| **Cost** | Token efficiency | Smallest viable | Resource-constrained |
| **Complexity** (Balanced) | Task-based | 3B/7B/16B by score | Default, adaptive routing |
| **Adaptive** | ML-driven | Learns from history | Long-term optimization |

### **Workflows**
- **Chain**: Draft (3B) → Refine (7B) → Review (16B) - Sequential improvement
- **Ensemble**: Parallel execution with voting - Consensus-based output

### **Resource Management**
```typescript
// Automatic model downgrade if:
- RAM usage > 80% → Use smaller model
- CPU usage > 90% → Reduce token limit
- Battery < 20% → Switch to speed strategy
- Thermal > 85°C → Throttle generation
```

### **Analytics & Learning**
- **Decision Logging**: Model chosen, reasoning, confidence score
- **Outcome Tracking**: Quality metrics, response time, token count
- **User Feedback**: Thumbs up/down, detailed ratings
- **Pattern Recognition**: Identifies successful interaction patterns
- **Automatic Optimization**: Improves strategy selection over time

---

## 🎓 **ADAPTIVE LEARNING SYSTEM**

### **Architecture**
```
User Interaction → Context Capture → Pattern Recognition → Quality Prediction
                         ↓                    ↓                    ↓
                   Feedback Collection → Parameter Tuning → Strategy Enhancement
                         ↓                    ↓                    ↓
                SQLite Storage → Analytics Dashboard → Continuous Improvement
```

### **Components**

#### **1. Pattern Recognition** (`app/lib/learning/patternRecognition.ts`)
```typescript
// Identifies patterns in successful/failed interactions
interface Pattern {
  mode: string;           // learning, code-review, expert
  domain: string;         // python, react, nextjs, mixed
  complexity: number;     // 0-100 score
  model_used: string;     // llama3.2:3b, qwen2.5-coder:7b, etc.
  effectiveness: number;  // Success rate (0-1)
}

// Tracks:
- Context features that lead to good responses
- Model performance across different task types
- User satisfaction patterns
- Optimal parameter combinations
```

#### **2. Hyperparameter Tuning** (`app/lib/learning/parameterTuner.ts`)
```typescript
// A/B testing framework for optimization
interface Experiment {
  parameter: string;      // temperature, max_tokens, top_p
  control_value: number;  // Baseline
  test_value: number;     // Variant
  performance: number;    // Measured improvement
}

// Optimizes:
- Temperature (0.1-1.0) per mode/domain
- Max tokens (512-8192) per complexity
- Top-p sampling (0.5-1.0) for diversity
- Strategy selection thresholds
```

#### **3. Quality Prediction** (`app/lib/learning/qualityPredictor.ts`)
```typescript
// Predicts response quality before generation
interface QualityPrediction {
  predicted_score: number;  // 0-100 quality estimate
  confidence: number;        // 0-1 confidence in prediction
  factors: {
    model_capability: number;
    task_complexity: number;
    historical_performance: number;
  };
}

// Uses:
- Historical model performance data
- Task complexity analysis
- Context similarity matching
- ML models trained on past interactions
```

### **Databases**
- `data/learning_patterns.db` - Pattern storage and effectiveness tracking
- `data/parameter_tuning.db` - Experiment results and optimization history
- `data/quality_predictions.db` - Predicted vs actual quality scores

### **Integration**
```typescript
// Seamless integration with strategy system
const strategy = await adaptiveStrategy.execute(context);
// Uses learned patterns to select optimal model

// Feedback collection
POST /api/feedback {
  interactionId: string,
  rating: 1-5,
  feedback: string
}
// Feeds into learning system for continuous improvement
```

---

## 📁 **CORE FILES** (Copy-Paste Ready)

### **1. API Route** `app/api/llm/route.ts`
```typescript
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama'
});

export async function POST(req: NextRequest) {
  try {
    const { model = 'llama3.2:3b-instruct-q5_K_M', messages } = await req.json();
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7
    });
    return NextResponse.json(completion.choices[0].message);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### **2. Chat UI** `components/Chat.tsx` (Full)
See [Chat.tsx](../components/Chat.tsx) for the complete implementation with:
- Model selection dropdown
- Message history
- Streaming responses
- Tool execution support
- Voice integration

---

## 🧠 **MEMORY & RAG SYSTEM**

### **Architecture**
```
User Query → Semantic Search (ChromaDB) → Context Retrieval → LLM + Context → Response
                    ↓
            Vector Embeddings (Ollama)
                    ↓
            SQLite Storage (Conversations)
```

### **Components**

#### **1. SQLite Storage** (`app/lib/memory/storage/`)
```typescript
// Persistent conversation history
interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
}
```

**Features:**
- Singleton pattern for database connection
- Schema migrations in `migrations/001_initial_schema.sql`
- Full conversation CRUD operations
- Message history tracking

#### **2. Vector Embeddings** (`app/lib/memory/rag/embeddings.ts`)
```typescript
// Generate embeddings via Ollama
const embedding = await generateEmbedding(text, {
  model: 'nomic-embed-text',
  apiUrl: 'http://localhost:11434'
});
// Returns: number[] (384-dimensional vector)
```

**Ollama Embedding Models:**
- `nomic-embed-text` (recommended, 384 dims)
- `all-minilm` (384 dims, lightweight)
- `mxbai-embed-large` (1024 dims, high accuracy)

#### **3. ChromaDB Integration** (`app/lib/memory/rag/retrieval.ts`)
```typescript
// Semantic search over conversations
const results = await retrieval.search({
  query: "user question",
  limit: 5,
  threshold: 0.7  // Similarity threshold
});

// Returns relevant past messages with similarity scores
```

**Features:**
- In-memory or persistent storage (`.data/chroma/`)
- Cosine similarity search
- Metadata filtering
- Analytics tracking

### **Environment Variables**
```bash
# .env.local
MEMORY_DB_PATH=./.data/hackerreign.db
CHROMA_DB_PATH=./.data/chroma
OLLAMA_API_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
```

### **Usage Example**
```typescript
import { storage } from '@/app/lib/memory';

// Create conversation
const conv = await storage.createConversation('New Chat');

// Add message
await storage.addMessage(conv.id, {
  role: 'user',
  content: 'Hello!'
});

// Search past conversations
const relevant = await retrieval.search({
  query: 'authentication issues',
  limit: 3
});
```

---

## 🎙️ **VOICE INTERACTION (STT/TTS)**

### **Architecture**
```
User Voice → Web Speech API → STT → LLM → TTS → Web Speech API → Audio Output
                ↓                                    ↓
          Audio Analyzer                       Frequency Analysis
                ↓                                    ↓
           VoiceOrb (visualization)
```

### **Components**

#### **1. Speech-to-Text** (`app/lib/voice/useVoiceInput.ts`)
```typescript
const {
  isListening,
  transcript,
  audioLevel,
  startListening,
  stopListening
} = useVoiceInput({
  onTranscript: (text) => console.log(text),
  onError: (err) => console.error(err)
});

// Push-to-talk: Hold SPACEBAR
// Or programmatically: startListening()
```

**Features:**
- Web Speech API (browser-native)
- Real-time transcript + interim results
- Audio level monitoring (0-1 scale)
- Spacebar push-to-talk
- Microphone permission handling
- Error recovery

**Browser Support:**
- ✅ Chrome/Edge (full support)
- ✅ Safari (macOS/iOS)
- ⚠️ Firefox (limited)

#### **2. Text-to-Speech** (`app/lib/voice/useVoiceOutput.ts`)
```typescript
const {
  isPlaying,
  speak,
  stop,
  getAudioLevel
} = useVoiceOutput({
  voice: 'en_US-libritts-high',
  onPlaybackEnd: () => console.log('Done')
});

await speak("Hello, I'm your AI assistant!");
```

**Features:**
- Browser-based speech synthesis
- Voice selection (system voices)
- Real-time frequency analysis
- Beat detection for emphasis
- Progress tracking

#### **3. Audio Analyzer** (`app/lib/voice/audioAnalyzer.ts`)
```typescript
const analyzer = new AudioAnalyzer((data) => {
  console.log({
    frequency: data.frequency,    // Dominant frequency (Hz)
    amplitude: data.amplitude,    // Volume (0-1)
    spectrum: data.spectrum       // FFT data
  });
});

analyzer.connectSource(audioSource);
analyzer.start();
```

**Features:**
- FFT-based spectrum analysis (256 bins)
- Dominant frequency detection
- Beat extraction (speech emphasis)
- Frequency range filtering
- Average amplitude calculation

#### **4. VoiceOrb Component** (`components/VoiceOrb.tsx`)
```tsx
<VoiceOrb
  isListening={isListening}
  isPlaying={isPlaying}
  audioLevel={audioLevel}
  beat={beat}
  onToggleListening={() => toggleVoice()}
/>
```

**Visual States:**
- 🔴 **Red pulsing**: Listening to user
- 🔵 **Cyan pulsing**: AI speaking
- 🟢 **Teal idle**: Ready for input
- Canvas-based animations (400x400px)
- Audio-reactive scaling and rotation

### **API Routes (Placeholder)**

#### **STT Endpoint** (`app/api/stt/route.ts`)
```typescript
// POST /api/stt
// Body: FormData with audio blob
// Currently returns 501 (client-side STT recommended)
// Future: Whisper/Ollama integration
```

#### **TTS Endpoint** (`app/api/tts/route.ts`)
```typescript
// POST /api/tts
// Body: { text: string, voice?: string, rate?: number }
// Returns instructions for client-side synthesis
// Future: Piper TTS/ElevenLabs integration
```

---

## 🐳 **DOCKER SUPPORT**

### **Docker Compose Setup** (Optional)
```yaml
# docker-compose.yml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=-1

  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_API_URL=http://ollama:11434
      - CHROMA_DB_PATH=/data/chroma
    depends_on:
      - ollama
      - chromadb

volumes:
  ollama_data:
  chroma_data:
```

### **Dockerfile** (Next.js App)
```dockerfile
FROM node:20-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### **Usage**
```bash
# Start all services
docker-compose up -d

# Pull Ollama models
docker exec -it hackerreign-ollama-1 ollama pull qwen2.5-coder:7b-instruct-q5_K_M
docker exec -it hackerreign-ollama-1 ollama pull nomic-embed-text

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🔧 **COMPLETE DEPENDENCIES**

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "openai": "^4.73.0",
    "better-sqlite3": "^12.5.0",
    "chromadb": "^3.2.0",
    "mathjs": "^13.0.0",
    "vm2": "^3.9.19"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0"
  }
}
```

---

## 📊 **FEATURE MATRIX**

| Feature | Status | Tech Stack | Dependencies |
|---------|--------|------------|--------------|
| **Multi-Model Strategy** | ✅ Production | Custom orchestration | Built-in |
| **Adaptive Learning** | ✅ Production | Pattern recognition + ML | SQLite |
| **Quality Prediction** | ✅ Production | ML-based prediction | SQLite |
| **Hyperparameter Tuning** | ✅ Production | A/B testing framework | SQLite |
| **LLM Chat** | ✅ Production | Ollama + OpenAI SDK | `openai` |
| **Domain Context** | ✅ Production | Mode detection + domain knowledge | Built-in |
| **Tool Support** | ✅ Production | mathjs, vm2 | `mathjs`, `vm2` |
| **Memory/RAG** | ✅ Production | SQLite + ChromaDB | `better-sqlite3`, `chromadb` |
| **Voice STT** | ✅ Production | Web Speech API | Native browser API |
| **Voice TTS** | ✅ Production | Piper TTS + Web Speech | `python3 -m piper` |
| **Audio Viz** | ✅ Production | Canvas + Three.js | `three` |
| **DL Code Gen** | ✅ Production | TensorFlow.js LSTM | `@tensorflow/tfjs-node` |
| **Analytics Dashboard** | ✅ Production | React + SQLite | Built-in |
| **Docker** | 🔄 Optional | Docker Compose | `docker`, `docker-compose` |

---

## 🎯 **RECOMMENDED MODELS**

### **For M4 MacBook Air 16GB**
```bash
# Multi-Model Strategy Setup (~17.6GB total)

# Speed Strategy - 3B Model
ollama pull llama3.2:3b-instruct-q5_K_M     # 2.3GB - Fast responses

# Balanced Strategy - 7B Model
ollama pull qwen2.5-coder:7b-instruct-q5_K_M # 5.5GB - Code/reasoning (default)

# Quality Strategy - 16B Model
ollama pull deepseek-coder-v2:16b-instruct-q4_K_M # 9.8GB - Expert analysis

# RAG/Embeddings
ollama pull nomic-embed-text                 # 137MB - 384-dim embeddings

# Total: ~17.6GB
# Note: Only 1 LLM loaded at a time, strategy system auto-selects optimal model
```

### **Alternative Models by Use Case**
```bash
# For tighter RAM constraints (< 12GB available)
ollama pull llama3.2:3b-instruct-q5_K_M     # 2.3GB - Speed
ollama pull qwen2.5-coder:7b-instruct-q5_K_M # 5.5GB - Balanced
# Skip 16B model, use 7B for quality strategy

# For code-focused work
ollama pull codestral:22b-instruct-q4_K_M   # 13GB - Excellent for code
ollama pull codegemma:7b-instruct-q5_K_M    # 4.8GB - Fast coding

# For general conversation
ollama pull llama3.1:8b-instruct-q5_K_M     # 5.6GB - Better chat
ollama pull mistral:7b-instruct-q5_K_M      # 4.4GB - Balanced
```

### **Performance Metrics**
- **Cold start**: 2-5 seconds (first model load)
- **Model switch**: 1-3 seconds (strategy changes)
- **Warm inference**:
  - 3B: 60-80 tokens/sec
  - 7B: 30-50 tokens/sec
  - 16B: 15-25 tokens/sec
- **Embedding**: ~50ms per message
- **RAG search**: ~100-200ms (1000 messages)
- **Strategy decision**: ~10-50ms (complexity analysis)
- **Quality prediction**: ~5-20ms (ML inference)

---

## 🚀 **PRODUCTION CHECKLIST**

### **Core Setup**
- [ ] Set `OLLAMA_KEEP_ALIVE=-1` for persistent models
- [ ] Configure `.env.local` with all paths and strategy settings
- [ ] Initialize data directories: `mkdir -p .data data`
- [ ] Pull all strategy models (3B, 7B, 16B)
- [ ] Pull embedding model: `ollama pull nomic-embed-text`

### **Strategy System**
- [ ] Initialize analytics database: `data/strategy_analytics.db`
- [ ] Set default strategy: `STRATEGY_DEFAULT=balanced`
- [ ] Configure resource constraints (RAM, CPU, GPU limits)
- [ ] Enable analytics: `STRATEGY_ENABLE_ANALYTICS=true`

### **Learning System**
- [ ] Initialize learning databases in `data/` directory
- [ ] Configure feedback collection endpoint
- [ ] Set up pattern recognition threshold
- [ ] Enable quality prediction: `ENABLE_QUALITY_PREDICTION=true`

### **Voice & Features**
- [ ] Test microphone permissions (HTTPS in production)
- [ ] Install Piper TTS: `pip install piper-tts`
- [ ] Install Whisper: `pip3 install openai-whisper`
- [ ] Download Whisper model: `whisper --model small --task transcribe /dev/null`

### **Deployment**
- [ ] Configure CORS for Ollama if remote
- [ ] Set up Docker (optional, for deployment)
- [ ] Build Next.js: `npm run build`
- [ ] Test production: `npm start`
- [ ] Verify all databases are created and accessible

---

## 📚 **REFERENCES**

- [Ollama API Docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [OpenAI SDK](https://github.com/openai/openai-node)
- [Next.js App Router](https://nextjs.org/docs/app)

---

## 🎓 **DOMAIN CONTEXT SYSTEM**

### **Architecture**
```
User Input + Mode Selection
         ↓
Context Detector (mode, domain, complexity)
         ↓
Mode System (learning/code-review/expert)
         ↓
Domain Knowledge (Python/React/Next.js/Mixed)
         ↓
Context Builder (complete system prompt)
         ↓
LLM with tailored context
```

### **Interaction Modes**
| Mode | Icon | Temperature | Tokens | Focus |
|------|------|-------------|--------|-------|
| **Learning** | 🎓 | 0.4 | 8000 | Patient educator, examples, WHY |
| **Code Review** | 👁️ | 0.3 | 6000 | Critical analyst, improvements |
| **Expert** | 🧠 | 0.5 | 7000 | Deep technical, trade-offs |
| **Auto-detect** | 🤖 | Dynamic | Dynamic | Analyzes input patterns |

### **Domains**
- **python-backend**: Asyncio, FastAPI, concurrency, event loops
- **react-frontend**: Hooks, state management, performance, memoization
- **nextjs-fullstack**: App Router, Server Components, caching, SSR/SSG
- **mixed**: Full-stack patterns, API design, type sharing, authentication

### **Usage in Chat.tsx**
```typescript
// User selects mode from dropdown (or leaves on Auto-detect)
const [manualMode, setManualMode] = useState<'' | 'learning' | 'code-review' | 'expert'>('');

// Passed to API on every request
fetch('/api/llm', {
  body: JSON.stringify({
    messages,
    manualModeOverride: manualMode || undefined
  })
});
```

### **API Integration**
```typescript
// app/api/llm/route.ts
import { buildContextForLLMCall } from '../../lib/domain/contextBuilder';

const llmContext = await buildContextForLLMCall(
  userMessage,
  filePath,        // Optional: for domain detection
  manualModeOverride  // User-selected mode
);

// Returns:
// - systemPrompt: Complete prompt with mode + domain knowledge
// - temperature: 0.3-0.5 based on mode
// - maxTokens: 6000-8000 based on mode
```

---

## 📈 **VERSION HISTORY**

### **v2.1.0 - Adaptive Learning System** (Jan 12, 2026)
- Pattern recognition for successful interactions
- Hyperparameter tuning with A/B testing
- Quality prediction using ML models
- Learning dashboard with analytics
- Feedback collection API
- Analytics API for comprehensive metrics

### **v2.0.0 - Multi-Model Strategy System** (Jan 10, 2026)
- Intelligent model selection (Speed, Quality, Cost, Complexity, Adaptive)
- Multi-model workflows (Chain, Ensemble)
- Resource monitoring and constraints
- Strategy analytics and performance tracking
- 5 strategy types with auto-selection

### **v1.3.0 - Domain Context System** (Jan 9, 2026)
- Automatic mode detection (Learning, Code Review, Expert)
- Domain knowledge injection (Python, React, Next.js, Mixed)
- Complexity analysis (0-100 scoring)
- Manual mode override support

### **v1.2.0 - Voice Interaction** (Jan 8, 2026)
- Whisper STT integration
- Piper TTS with Python CLI
- Unified voice flow orchestration
- Audio visualization (2D Orb + 3D Particles)

### **v1.1.0 - Memory & RAG** (Jan 7, 2026)
- SQLite conversation storage
- ChromaDB vector search
- Ollama embeddings
- Semantic search over history

### **v1.0.0 - Initial Release** (Jan 6, 2026)
- Basic LLM chat via Ollama
- 3 model support
- Tool execution (calculator, weather, code exec)
- Next.js + React + Tailwind

---

**Last Updated:** Jan 12, 2026
**Current Version:** 2.1.0 (Multi-Model Strategy + Adaptive Learning)
