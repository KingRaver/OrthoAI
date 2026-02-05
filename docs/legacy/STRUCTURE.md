# Project Structure

```
hackerreign/
├── .vscode/                      # VSCode workspace settings
│   ├── css-custom-data.json      # Custom CSS definitions for Tailwind v4
│   └── settings.json             # Editor configuration
│
├── app/                          # Next.js App Router directory
│   ├── api/                      # API routes
│   │   ├── analytics/            # Analytics endpoint
│   │   │   └── route.ts          # Strategy and learning analytics API
│   │   ├── dl-codegen/           # Deep learning code generation endpoints
│   │   │   ├── train/            # Model training endpoint
│   │   │   │   └── route.ts      # Train LSTM model on code samples
│   │   │   └── predict/          # Code prediction endpoint
│   │   │       └── route.ts      # Generate code completions using trained model
│   │   ├── feedback/             # User feedback endpoint
│   │   │   └── route.ts          # Collect user feedback on AI responses
│   │   ├── llm/                  # LLM endpoint
│   │   │   └── route.ts          # LLM API handler with tool support & strategy selection
│   │   ├── piper-tts/            # Piper TTS endpoint
│   │   │   └── route.ts          # Server-side Piper TTS with Python CLI integration
│   │   ├── stt/                  # Speech-to-Text endpoint
│   │   │   └── route.ts          # STT API (placeholder for future server-side STT)
│   │   └── tts/                  # Text-to-Speech endpoint
│   │       └── route.ts          # TTS API (client-side synthesis instructions)
│   ├── lib/                      # Shared utilities and libraries
│   │   ├── dl-codegen/           # Deep learning code generation system
│   │   │   ├── index.ts          # Main exports and public API
│   │   │   ├── types.ts          # TypeScript type definitions
│   │   │   ├── preprocess.ts     # Text tokenization and sequence preparation
│   │   │   ├── model.ts          # LSTM neural network architecture (TensorFlow.js)
│   │   │   └── train.ts          # Training loop and model persistence
│   │   ├── learning/             # Adaptive learning and quality prediction system
│   │   │   ├── README.md         # Learning system documentation
│   │   │   ├── patternRecognition.ts  # Pattern recognition and analysis
│   │   │   ├── parameterTuner.ts      # Hyperparameter tuning and optimization
│   │   │   └── qualityPredictor.ts    # Quality prediction and assessment
│   │   ├── domain/               # Domain context detection system
│   │   │   ├── contextDetector.ts  # Detects mode, file type, domain, complexity
│   │   │   ├── modeDefinitions.ts  # Interaction mode system prompts
│   │   │   ├── domainKnowledge.ts  # Domain-specific knowledge base
│   │   │   └── contextBuilder.ts   # Orchestrates detection and prompt building
│   │   ├── memory/               # Memory and RAG system
│   │   │   ├── index.ts          # Storage singleton exports
│   │   │   ├── schemas.ts        # TypeScript schemas for conversations/messages
│   │   │   ├── storage/          # Data persistence layer
│   │   │   │   ├── index.ts      # SQLite storage singleton management
│   │   │   │   └── sqlite.ts     # SQLite implementation for conversations
│   │   │   ├── rag/              # Retrieval-Augmented Generation
│   │   │   │   ├── index.ts      # RAG exports
│   │   │   │   ├── embeddings.ts # Ollama embeddings integration
│   │   │   │   └── retrieval.ts  # ChromaDB vector search
│   │   │   ├── migrations/       # Database schema migrations
│   │   │   │   ├── init.sql      # Initial schema
│   │   │   │   └── 002_strategy_analytics.sql # Strategy analytics tables
│   │   │   ├── README.md         # Memory system documentation
│   │   │   ├── INTEGRATION_GUIDE.md  # Integration instructions
│   │   │   └── FILE_MANIFEST.md  # File descriptions
│   │   ├── strategy/             # LLM strategy selection and orchestration
│   │   │   ├── types.ts          # Strategy type definitions and interfaces
│   │   │   ├── context.ts        # Request context analysis
│   │   │   ├── baseStrategy.ts   # Abstract base strategy class
│   │   │   ├── manager.ts        # Strategy registry and selection logic
│   │   │   ├── orchestrator.ts   # Multi-strategy orchestration
│   │   │   ├── implementations/  # Concrete strategy implementations
│   │   │   │   ├── speedStrategy.ts      # Fast responses (smaller models)
│   │   │   │   ├── qualityStrategy.ts    # High-quality outputs (larger models)
│   │   │   │   ├── costStrategy.ts       # Cost-optimized (efficient models)
│   │   │   │   ├── complexityStrategy.ts # Task complexity-based selection
│   │   │   │   ├── adaptiveStrategy.ts   # Learning-based adaptation
│   │   │   │   └── workflowStrategy.ts   # Multi-model orchestration (chain/ensemble)
│   │   │   ├── workflows/        # Multi-model workflow patterns
│   │   │   │   ├── chain.ts      # Sequential model chaining
│   │   │   │   └── ensemble.ts   # Parallel ensemble voting
│   │   │   ├── resources/        # Resource management
│   │   │   │   ├── monitor.ts    # System resource monitoring
│   │   │   │   └── constraints.ts # Resource constraint enforcement
│   │   │   └── analytics/        # Strategy performance tracking
│   │   │       └── tracker.ts    # SQLite-based analytics
│   │   ├── voice/                # Voice interaction system
│   │   │   ├── useVoiceInput.ts  # Speech-to-Text hook (Web Speech API)
│   │   │   ├── useVoiceOutput.ts # Text-to-Speech hook (Web Speech API + Piper TTS)
│   │   │   ├── useVoiceFlow.ts   # Unified voice flow orchestration hook
│   │   │   ├── voiceStateManager.ts # Centralized state management for voice flow
│   │   │   ├── audioAnalyzer.ts  # Audio frequency analysis and beat detection
│   │   │   ├── audioRecorder.ts  # Audio recording utilities
│   │   │   ├── README.md         # Voice system documentation
│   │   │   ├── QUICK_TEST.md     # Testing guide
│   │   │   ├── SPEECH_DETECTION_FIX.md # Speech detection troubleshooting
│   │   │   └── VOICE_OPTIMIZATION.md # Performance optimization guide
│   │   └── tools/                # LLM tool integration
│   │       ├── index.ts          # Tool exports and configuration
│   │       ├── definitions.ts    # Tool JSON schemas
│   │       ├── executor.ts       # Tool execution engine with handler mapping
│   │       └── handlers/         # Individual tool implementations
│   │           ├── weather.ts    # Weather tool (mock data)
│   │           ├── calc.ts       # Calculator tool (mathjs)
│   │           └── code-exec.ts  # Code execution tool (vm2 sandbox)
│   ├── favicon.ico               # Site favicon
│   ├── globals.css               # Global styles with Tailwind v4
│   ├── layout.tsx                # Root layout component
│   └── page.tsx                  # Home page
│
├── components/                   # React components
│   ├── Chat.tsx                  # Chat interface component
│   ├── LearningDashboard.tsx     # Learning system dashboard and analytics UI
│   ├── TopNav.tsx                # Top navigation bar component
│   ├── VoiceOrb.tsx              # Canvas-based 2D voice visualization component
│   └── ParticleOrb.tsx           # Three.js 3D particle visualization component
│
├── .data/                        # Runtime data storage (not in git)
│   ├── chroma/                   # ChromaDB vector database
│   ├── chroma.log                # ChromaDB logs
│   ├── dl-model.pt               # Trained deep learning model
│   ├── hackerreign.db            # Main SQLite database
│   ├── hackerreign.db-shm        # SQLite shared memory
│   └── hackerreign.db-wal        # SQLite write-ahead log
│
├── data/                         # Application data
│   ├── learning_patterns.db      # Pattern recognition database
│   ├── parameter_tuning.db       # Hyperparameter tuning database
│   ├── quality_predictions.db    # Quality prediction database
│   ├── strategy_analytics.db     # Strategy performance analytics database
│   └── mode_analytics.db         # Mode interaction analytics database
│
├── public/                       # Static assets
│   ├── codesnippets.json         # Code snippet library
│   ├── favicon.ico               # Site favicon
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
├── .env.local                    # Environment variables (not in git)
├── .gitignore                    # Git ignore rules
├── CLEANING.md                   # Code cleanup and refactoring notes
├── FUTURE.md                     # Future features and roadmap
├── LICENSE.md                    # Project license
├── MODELS.md                     # LLM models reference guide
├── OUTLINE.md                    # Project outline/planning
├── README.md                     # Project documentation
├── STRUCTURE.md                  # This file - project structure reference
├── eslint.config.mjs             # ESLint configuration
├── global.d.ts                   # Global TypeScript declarations
├── next-env.d.ts                 # Next.js TypeScript declarations
├── next.config.ts                # Next.js configuration
├── package.json                  # Project dependencies and scripts
├── package-lock.json             # Locked dependency versions
├── postcss.config.mjs            # PostCSS configuration
├── tailwind.config.ts            # Tailwind CSS configuration
└── tsconfig.json                 # TypeScript configuration
```

## Key Directories

### `/app`
Next.js 14+ App Router structure. Contains all pages, layouts, and API routes.

### `/app/api`
Server-side API endpoints. Currently hosts the LLM integration with tool support.

### `/app/lib`
Shared utilities and libraries used across the application.

#### `/app/lib/dl-codegen`
Deep learning-based code generation system using TensorFlow.js:
- **index.ts** - Main exports and public API surface
- **types.ts** - TypeScript type definitions for model, training, and prediction
- **preprocess.ts** - Text tokenization, vocabulary building, and sequence padding
- **model.ts** - LSTM neural network architecture with embedding and dense layers
- **train.ts** - Training loop with batch processing and model serialization

**Features:**
- LSTM-based sequence-to-sequence learning for code completion
- Character-level tokenization with configurable vocabulary
- TensorFlow.js for browser and Node.js compatibility
- Model persistence to filesystem (.data/dl-model.pt)
- Batch training with configurable epochs and batch size
- Temperature-based sampling for diverse predictions

**Dependencies:**
- `@tensorflow/tfjs-node` - TensorFlow.js for Node.js
- Training data stored in public/codesnippets.json

**API Endpoints:**
- POST `/api/dl-codegen/train` - Train model on code samples
- POST `/api/dl-codegen/predict` - Generate code completions

#### `/app/lib/learning`
Adaptive learning and quality prediction system for continuous improvement:
- **patternRecognition.ts** - Identifies patterns in successful/failed interactions
- **parameterTuner.ts** - Optimizes hyperparameters based on feedback and performance
- **qualityPredictor.ts** - Predicts response quality before generation
- **README.md** - Documentation for the learning system

**Features:**
- Pattern recognition across multiple interaction types
- Automated hyperparameter tuning with A/B testing
- Quality prediction using machine learning models
- SQLite-based data persistence for learning patterns
- Continuous feedback loop for model improvement
- Integration with strategy selection system
- Performance metrics and analytics tracking

**Databases:**
- `data/learning_patterns.db` - Stores recognized patterns and their effectiveness
- `data/parameter_tuning.db` - Tracks parameter experiments and results
- `data/quality_predictions.db` - Historical quality predictions and outcomes

**Integration:**
- Works with adaptive strategy for intelligent model selection
- Feeds into analytics system for comprehensive insights
- Uses user feedback via `/api/feedback` endpoint
- Monitors and optimizes strategy performance over time

#### `/app/lib/domain`
Domain-aware context detection and system prompt generation:
- **contextDetector.ts** - Analyzes user input to detect interaction mode, file type, domain, and complexity
- **modeDefinitions.ts** - Three interaction modes with specialized system prompts (learning, code-review, expert)
- **domainKnowledge.ts** - Domain-specific knowledge base for Python backend, React frontend, Next.js fullstack, and mixed projects
- **contextBuilder.ts** - Orchestrates detection and builds complete system prompts with domain knowledge injection

**Features:**
- Automatic mode detection from user input (learning, code review, expert)
- Domain detection from file paths and code patterns (Python, React, Next.js, mixed)
- Dynamic temperature and token limits based on mode
- Domain-specific knowledge injection (asyncio patterns, React hooks, API design, etc.)
- Manual mode override support for user preference
- Complexity analysis (simple, moderate, complex)
- Confidence scoring for detection quality

**Interaction Modes:**
- **Learning Mode** (🎓) - Patient educator with examples and analogies (temp: 0.4, 8000 tokens)
- **Code Review Mode** (👁️) - Critical analyst focused on quality improvements (temp: 0.3, 6000 tokens)
- **Expert Mode** (🧠) - Deep technical discussion with trade-offs (temp: 0.5, 7000 tokens)

**Domains:**
- **python-backend** - Async/await, asyncio, FastAPI, concurrency patterns
- **react-frontend** - React hooks, state management, performance optimization
- **nextjs-fullstack** - App Router, Server Components, API routes, SSR/SSG
- **mixed** - Full-stack architecture spanning Python backend and React/Next.js frontend

#### `/app/lib/memory`
Memory and RAG (Retrieval-Augmented Generation) system:
- **storage/** - SQLite-based conversation and message persistence
- **rag/** - Vector embeddings and semantic search using ChromaDB and Ollama
- **schemas.ts** - TypeScript types for conversations and messages
- **migrations/** - Database schema version control

**Features:**
- Conversation history storage with SQLite
- Semantic search over past conversations using vector embeddings
- Ollama integration for generating embeddings
- ChromaDB for efficient vector similarity search
- Analytics tracking for search queries and retrieval performance

**Dependencies:**
- `better-sqlite3` - SQLite database driver
- `chromadb` - Vector database for semantic search

#### `/app/lib/strategy`
LLM strategy selection and multi-model orchestration system:
- **types.ts** - Core type definitions (Strategy, RequestContext, StrategyResult, etc.)
- **context.ts** - Request context analysis (complexity, urgency, domain detection)
- **baseStrategy.ts** - Abstract base class for all strategy implementations
- **manager.ts** - Strategy registry, selection logic, and lifecycle management
- **orchestrator.ts** - Multi-strategy coordination (fallbacks, retries, consensus)

**Strategy Implementations** (`implementations/`):
- **speedStrategy.ts** - Optimizes for fast response times using lightweight models
- **qualityStrategy.ts** - Maximizes output quality with larger, more capable models
- **costStrategy.ts** - Minimizes computational cost and resource usage
- **complexityStrategy.ts** - Selects models based on task complexity analysis
- **adaptiveStrategy.ts** - Learns from past performance to improve selection over time
- **workflowStrategy.ts** - Multi-model orchestration with chain (sequential) or ensemble (parallel voting) modes

**Workflow Patterns** (`workflows/`):
- **chain.ts** - Sequential model chaining (e.g., draft → refine → polish)
- **ensemble.ts** - Parallel ensemble voting for consensus-based outputs

**Resource Management** (`resources/`):
- **monitor.ts** - Real-time system resource monitoring (CPU, memory, model availability)
- **constraints.ts** - Resource constraint enforcement and threshold management

**Analytics** (`analytics/`):
- **tracker.ts** - SQLite-based performance tracking and analytics
  - Strategy effectiveness metrics
  - Model performance comparison
  - Request pattern analysis
  - Database: data/strategy_analytics.db

**Features:**
- Automatic model selection based on task characteristics
- Multi-model orchestration with fallback chains
- Performance-based learning and adaptation
- Resource-aware scheduling and throttling
- Comprehensive analytics and monitoring
- Support for custom strategy implementations

**Dependencies:**
- SQLite for analytics persistence (data/strategy_analytics.db)
- Integrates with domain detection system
- Works with all Ollama-compatible models

#### `/app/lib/voice`
Voice interaction system for speech input/output with unified flow orchestration:
- **useVoiceInput.ts** - React hook for speech-to-text using Web Speech API
- **useVoiceOutput.ts** - React hook for text-to-speech (Web Speech API + Piper TTS)
- **useVoiceFlow.ts** - Unified voice flow orchestration combining STT, TTS, and auto-resume
- **voiceStateManager.ts** - Centralized state management with pub/sub pattern
- **audioAnalyzer.ts** - Real-time audio frequency analysis and beat detection

**Features:**
- **Conversation Flow**: idle → listening → processing → thinking → generating → speaking → auto-resume
- Browser-based speech recognition (Web Speech API)
- Server-side TTS with Piper Python integration
- Real-time audio level monitoring and visualization
- Spacebar push-to-talk functionality
- Auto-resume listening after AI responses (500ms delay)
- State management with observer pattern for React components
- Frequency analysis for visual feedback
- Beat detection for responsive UI animations
- Microphone permission handling and error recovery

**State Machine:**
- `idle` - Ready, waiting for user interaction
- `listening` - Recording user speech
- `processing` - Converting speech to text
- `thinking` - LLM generating response
- `generating` - Converting response to speech
- `speaking` - Playing audio response
- `error` - Error state with message

**Dependencies:**
- Built on native browser APIs (Web Speech API)
- Piper TTS via Python CLI for server-side synthesis
- Compatible with Chrome, Edge, and Safari

#### `/app/lib/tools`
LLM tool integration system:
- **index.ts** - Central export point for tool definitions
- **definitions.ts** - JSON schemas for tool parameters (weather, calculator, code execution)
- **executor.ts** - Tool execution engine with handler mapping and error handling
- **handlers/** - Individual tool implementations with sandboxing and validation

**Features:**
- Tool handler name mapping (fixes dynamic import issues)
- Comprehensive logging for debugging tool execution
- Error handling with stack traces
- Support for calculator (mathjs), weather (mock API), and code execution (vm2 sandbox)

### `/components`
Reusable React components used across the application:
- **Chat.tsx** - Main chat interface with message history, input, and voice flow integration
  - Integrates with useVoiceFlow for voice conversation
  - Mode selector dropdown for manual mode override (Auto-detect, Learning, Code Review, Expert)
  - Subscribes to voice state changes for UI updates
  - Handles LLM responses and auto-TTS playback
  - Passes selected mode to API for context-aware responses
- **LearningDashboard.tsx** - Learning system dashboard and analytics visualization
  - Displays learning patterns, metrics, and insights
  - Real-time performance tracking and quality predictions
  - Parameter tuning status and experiment results
  - Integration with learning system databases
  - Visual charts and graphs for analytics data
- **TopNav.tsx** - Top navigation bar component
  - Application-wide navigation and controls
  - Quick access to features and settings
  - Responsive design for mobile and desktop
  - Integration with app routing and state management
- **VoiceOrb.tsx** - Canvas-based 2D animated orb for voice visualization
  - Real-time audio level visualization with pulsing effects
  - State-based color schemes (listening: red, speaking: cyan, idle: teal)
  - Smooth interpolation for natural animations
  - Click and spacebar interaction support
- **ParticleOrb.tsx** - Three.js-based 3D particle visualization component
  - 1000 particles with physics-based animation
  - Sphere boundary with collision detection
  - State-based forces (inward collapse when listening, outward pulse when speaking)
  - Audio-reactive particle motion and beat detection
  - Smooth color transitions between states
  - Velocity damping and dynamic scaling

### `/public`
Static files served directly by Next.js without processing.

### `/.vscode`
VSCode-specific settings for consistent development experience.

## Configuration Files

- **next.config.ts** - Next.js framework configuration
- **tsconfig.json** - TypeScript compiler options
- **tailwind.config.ts** - Tailwind CSS v4 customization
- **postcss.config.mjs** - PostCSS plugins (including Tailwind)
- **eslint.config.mjs** - Code linting rules
- **global.d.ts** - Custom TypeScript type declarations

## Scripts

See `package.json` for available npm scripts:
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Check TypeScript types

## Recent Updates

### Adaptive Learning System (January 2026)
- **Pattern Recognition**: Automated pattern detection in user interactions
  - Identifies successful and unsuccessful interaction patterns
  - Tracks context features (mode, domain, complexity, model used)
  - SQLite-based pattern storage (data/learning_patterns.db)
  - Pattern effectiveness scoring and ranking

- **Parameter Tuning**: Intelligent hyperparameter optimization
  - A/B testing framework for parameter experiments
  - Automated tuning based on user feedback and performance metrics
  - Temperature, max tokens, top-p optimization
  - Experiment tracking and result analysis (data/parameter_tuning.db)

- **Quality Prediction**: Pre-generation quality assessment
  - Predicts response quality before generating output
  - Uses historical data and ML models for prediction
  - Confidence scoring for quality estimates
  - Integration with strategy selection for optimal routing
  - Quality tracking database (data/quality_predictions.db)

- **Learning Dashboard**: Visual analytics interface
  - Real-time learning metrics and insights
  - Pattern effectiveness visualization
  - Parameter tuning experiment results
  - Quality prediction accuracy tracking
  - Interactive charts and graphs

- **Feedback API**: User feedback collection endpoint
  - POST `/api/feedback` - Collect user ratings and feedback
  - Feeds into learning system for continuous improvement
  - Tracks feedback by interaction ID
  - Integration with pattern recognition and quality prediction

- **Analytics API**: Comprehensive analytics endpoint
  - GET `/api/analytics` - Retrieve learning and strategy analytics
  - Aggregated metrics across all systems
  - Historical trend analysis
  - Performance comparison reports

**Integration:**
- Works seamlessly with adaptive strategy for intelligent model selection
- Enhances domain context system with learned patterns
- Continuous feedback loop improves over time
- All learning data persisted in SQLite databases

### LLM Strategy Selection System (January 2026)
- **Strategy Framework**: Intelligent model selection based on task characteristics
  - Five core strategies: Speed, Quality, Cost, Complexity, Adaptive
  - Pluggable architecture with abstract base class
  - Strategy registry with priority-based selection
  - Request context analysis (complexity, urgency, domain)

- **Multi-Model Orchestration**: Workflows for combining multiple models
  - Chain workflow: Sequential processing (draft → refine → verify)
  - Ensemble workflow: Parallel voting for consensus
  - Fallback chains with automatic retry logic
  - Timeout and error handling

- **Resource Management**: System-aware resource monitoring
  - Real-time CPU and memory tracking
  - Model availability checking
  - Resource constraint enforcement
  - Throttling and load balancing

- **Analytics & Learning**: Performance tracking and adaptation
  - SQLite-based analytics (data/strategy_analytics.db)
  - Strategy effectiveness metrics
  - Model performance comparison
  - Adaptive learning from historical data
  - Request pattern analysis

- **Integration**: Works seamlessly with existing systems
  - Domain detection integration for context-aware selection
  - Compatible with all Ollama models
  - Fallback to default model on failure
  - Migration support (002_strategy_analytics.sql)

**Example Use Cases:**
- Quick answers → Speed Strategy → llama3.2:3b
- Complex code review → Quality Strategy → deepseek-coder-v2:16b
- Resource-constrained → Cost Strategy → codegemma:7b
- Multi-file refactor → Chain Workflow → qwen2.5-coder:7b → codestral:22b
- Consensus needed → Ensemble Workflow → 3 models vote

### Deep Learning Code Generation (January 2026)
- **LSTM Neural Network**: Browser and Node.js compatible code generation
  - Character-level tokenization and vocabulary building
  - Embedding layer + LSTM layers + Dense output
  - Temperature-based sampling for diversity
  - Model persistence to .data/dl-model.pt

- **Training Pipeline**: Full training infrastructure
  - POST /api/dl-codegen/train endpoint
  - Batch processing with configurable parameters
  - Training data from public/codesnippets.json
  - TensorFlow.js integration (@tensorflow/tfjs-node)

- **Code Prediction**: Real-time code completion
  - POST /api/dl-codegen/predict endpoint
  - Context-aware sequence generation
  - Configurable prediction length
  - Fast inference for interactive use

**Features:**
- Offline code completion without API calls
- Customizable training on project-specific code
- Lightweight and fast predictions
- Privacy-preserving (all local)

### Domain Context System (January 2026)
- **Context Detection**: Automatic mode and domain detection from user input
  - Analyzes user input for learning, code review, or expert mode signals
  - Detects file types (Python, TypeScript, React, Next.js) from paths and patterns
  - Identifies primary domain (backend, frontend, fullstack, mixed)
  - Calculates complexity level (simple, moderate, complex)
  - Confidence scoring for detection quality (0-1 scale)

- **Mode System**: Three specialized interaction modes with tailored system prompts
  - **Learning Mode** (🎓) - Patient educator focusing on "why" with examples
  - **Code Review Mode** (👁️) - Critical analyst prioritizing code quality
  - **Expert Mode** (🧠) - Deep technical discussion with trade-offs and edge cases
  - Dynamic temperature and token limits per mode
  - Mode-specific response structures and tone

- **Domain Knowledge**: Context-aware knowledge injection
  - **Python Backend** - Asyncio, FastAPI, concurrency patterns, event loops
  - **React Frontend** - Hooks lifecycle, state management, memoization, performance
  - **Next.js Fullstack** - App Router, Server Components, caching strategies
  - **Mixed Domain** - Full-stack patterns, API design, type sharing, authentication
  - Best practices and common pitfalls for each domain
  - Automatic injection into system prompts based on detection

- **UI Integration**: Mode selector in Chat.tsx
  - Dropdown with 4 options: Auto-detect (🤖), Learning (🎓), Code Review (👁️), Expert (🧠)
  - Manual mode override capability
  - Footer status indicator showing active mode
  - Seamless integration with existing voice and tool systems

- **API Integration**: LLM route enhanced with context building
  - `buildContextForLLMCall()` function for every request
  - Accepts `filePath` and `manualModeOverride` parameters
  - Dynamic system prompt generation with domain knowledge
  - Natural language output rules preserved
  - Memory augmentation compatibility maintained

**Example Flow:**
1. User selects "Learning Mode" or leaves on "Auto-detect"
2. User types: "Can you explain async/await in Python?"
3. System detects: Learning mode (if auto) + Python backend domain
4. Context builder generates system prompt with:
   - Learning mode instructions (patient teacher style)
   - Python async knowledge (asyncio, event loops, coroutines)
   - Natural language formatting rules
5. LLM responds with educational explanation tailored to Python context

### Voice Interaction System - Full Piper TTS Integration (January 2026)
- **Unified Voice Flow**: Complete conversation orchestration with auto-resume
  - State machine: idle → listening → processing → thinking → generating → speaking → auto-resume
  - Centralized state management with pub/sub pattern
  - 500ms delay before auto-resume for natural conversation pacing
  - useVoiceFlow hook combines STT, TTS, and flow control
  - voiceStateManager for cross-component state synchronization

- **Piper TTS Server Integration**: Production-ready server-side text-to-speech
  - Python CLI integration via `python3 -m piper`
  - Voice model management in `~/.piper/models/`
  - GET `/api/piper-tts/voices` - List available voice models
  - POST `/api/piper-tts` - Generate speech audio (WAV format)
  - ARM64 architecture support for Apple Silicon
  - 30-second timeout protection
  - Temporary file cleanup and error handling
  - Up to 5000 character text limit

- **Speech-to-Text (STT)**: Web Speech API integration for real-time voice input
  - Push-to-talk with spacebar control
  - Continuous and interim transcript support
  - Real-time audio level monitoring for visual feedback
  - Browser-based recognition (no server required)
  - Error handling for microphone permissions and network issues

- **Text-to-Speech (TTS)**: Dual-mode TTS system
  - Primary: Piper TTS via Python CLI for high-quality server-side synthesis
  - Fallback: Web Speech API for browser-based synthesis
  - Voice selection support
  - Real-time frequency analysis for visualization
  - Beat detection for responsive UI animations

- **3D Particle Visualization**: Advanced Three.js particle system
  - ParticleOrb component with 1000 particles
  - Physics-based motion with velocity and forces
  - Sphere boundary with collision detection
  - State-based particle behavior (collapse/expand)
  - Audio-reactive motion and beat pulses
  - Smooth color transitions between states

- **Voice Visualization**: Canvas-based 2D orb component
  - VoiceOrb with state-aware color schemes
  - Audio-reactive pulsing and scaling
  - Smooth interpolation for natural motion
  - Click and keyboard controls

- **API Endpoints**:
  - `/api/piper-tts` - Full Piper TTS integration (GET for voices, POST for synthesis)
  - `/api/tts` - Web Speech API fallback route
  - `/api/stt` - Placeholder for future Whisper integration

- **Audio Analysis**: Real-time frequency and amplitude tracking
  - FFT-based spectrum analysis
  - Beat detection for speech emphasis
  - Configurable frequency range filtering

### Memory & RAG System Addition (December 2025)
- **Conversation Storage**: SQLite-based persistence for conversations and messages
- **Vector Search**: ChromaDB integration for semantic search over conversation history
- **Embeddings**: Ollama integration for generating vector embeddings
- **Analytics**: Search query tracking and performance metrics
- **Dependencies Added**:
  - `better-sqlite3` (v12.5.0) - SQLite database driver
  - `@types/better-sqlite3` (v7.6.13) - TypeScript definitions
  - `chromadb` (v3.2.0) - Vector database client

### Additional Dependencies
- **3D Graphics**: `three` (v0.160.0), `@types/three` (v0.182.0) - For ParticleOrb 3D visualization
- **AI SDKs**:
  - `ai` (v6.0.20) - Vercel AI SDK for LLM integration
  - `openai` (v6.15.0) - OpenAI SDK for GPT models
- **Machine Learning**:
  - `@tensorflow/tfjs-node` - TensorFlow.js for Node.js (LSTM code generation)
  - `@tensorflow/tfjs` - TensorFlow.js for browser (optional)
- **Python Runtime**: `pyodide` (v0.29.1) - Python in the browser for code execution
- **Schema Validation**: `zod` (v4.3.5) - Runtime type checking and validation
- **Math**: `mathjs` (v15.1.0) - Calculator tool implementation

### LLM API & Tool System Improvements
- **Timeout Protection**: Added 30-second fetch timeouts with AbortController to prevent indefinite hanging
- **Tool Handler Mapping**: Fixed dynamic import issues by mapping tool names to correct file names
- **Enhanced Logging**: Comprehensive logging throughout request lifecycle with timestamps and stack traces
- **Error Handling**: Better error messages with context, duration tracking, and debugging information
- **Loop Protection**: Max 5 tool loop iterations to prevent infinite loops
- **Dependencies**: Verified `mathjs` and `vm2` are properly installed and configured
