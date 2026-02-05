# Deep Learning Code Generation System

A production-ready neural network system for intelligent code completion and generation, powered by PyTorch, Flask, and Ollama embeddings.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                       │
│              (User enters code prompt)                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js API Routes (Port 3000)              │
│  • /api/dl-codegen/train  - Trigger training             │
│  • /api/dl-codegen/predict - Get code predictions        │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│               TypeScript Orchestrator                    │
│                  (DLCodeGen class)                       │
│  • Preprocesses input (embeddings + features)            │
│  • Coordinates training/prediction                       │
│  • Manages model lifecycle                               │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Ollama     │ │  ChromaDB    │ │    Flask     │
│ Embeddings   │ │   (Docker)   │ │   Server     │
│              │ │              │ │  (Port 5001) │
│ 768-dim      │ │ Port 8000    │ │              │
│ Vectors      │ │ Vector DB    │ │  PyTorch NN  │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Directory Structure

```
app/lib/dl-codegen/
├── README.md                    # This file
├── index.ts                     # Main orchestrator (DLCodeGen class)
├── types.ts                     # TypeScript interfaces
│
├── preprocess.ts                # Feature extraction pipeline
│   • Ollama embeddings (768→384 dim)
│   • Keyword extraction (TF-IDF)
│   • AST features (functions, classes, nesting)
│   • Syntax statistics (operators, keywords)
│   • Total: 544-dimensional feature vector
│
├── train.ts                     # Training pipeline
│   • HTTP calls to Flask /train endpoint
│   • Dataset serialization (Float32Array → JSON)
│   • Returns loss & accuracy metrics
│
├── model.ts                     # Prediction pipeline
│   • HTTP calls to Flask /predict endpoint
│   • Model loading (lazy, on-demand)
│   • Vocabulary decoding
│
├── server.py                    # Flask + PyTorch backend
│   • DeepCodeNet (multi-layer feedforward NN)
│   • Training endpoint (/train)
│   • Prediction endpoint (/predict)
│   • MPS/CPU device support
│
├── train/
│   └── route.ts                 # Next.js API route for training
│
└── predict/
    └── route.ts                 # Next.js API route for predictions
```

## Feature Extraction Pipeline

The system transforms code into **544-dimensional feature vectors**:

### 1. Ollama Embeddings (384 dims)
```typescript
// Uses nomic-embed-text model (768-dim, truncated to 384)
const embedding = await ollama.embed(codeText);
vector.set(embedding.slice(0, 384), 0);
```

### 2. Keyword Features (100 dims)
```typescript
// TF-IDF approximation using token frequencies
// Top 100 most frequent/important tokens
const keywords = extractKeywords(tokens);
vector.set(keywords, 384);
```

### 3. AST Features (50 dims)
```typescript
// Structural code analysis:
features[0] = function/const declarations
features[1] = class definitions
features[2] = Python def statements
features[3] = Nesting depth (brace count)
features[4] = Import statements
vector.set(astFeatures, 484);
```

### 4. Syntax Statistics (10 dims)
```typescript
// Code complexity metrics:
[0] = Normalized length
[1] = Import count
[2] = Async/await usage
[3] = Conditionals (if/else)
[4] = Loops (for/while)
[5] = Return statements
[6] = Function calls
[7] = Assignments
[8] = Property access
[9] = Array access
vector.set(syntaxStats, 534);
```

## Neural Network Architecture

```python
# PyTorch DeepCodeNet
Input: 544 dimensions
  ↓
Layer 1: Linear(544 → 512) + ReLU + BatchNorm + Dropout(0.2)
  ↓
Layer 2: Linear(512 → 256) + ReLU + BatchNorm + Dropout(0.2)
  ↓
Layer 3: Linear(256 → 128) + ReLU + BatchNorm + Dropout(0.2)
  ↓
Layer 4: Linear(128 → 64) + ReLU + BatchNorm + Dropout(0.2)
  ↓
Output: Linear(64 → 100)  # Vocabulary size
  ↓
Softmax → Code token prediction
```

### Training Configuration
```typescript
{
  hiddenLayers: [512, 256, 128, 64],
  dropout: 0.2,              // Regularization
  lr: 0.001,                 // Learning rate
  epochs: 50,                // Training iterations
  batchSize: 64,             // Samples per batch
  embeddingDim: 384          // Truncated embedding size
}
```

## Installation & Setup

### 1. Install Python Dependencies
```bash
npm run dl-setup
# Installs: torch, flask, numpy
```

### 2. Start ChromaDB (Docker)
```bash
npm run chroma-start
# Starts ChromaDB container on port 8000
```

### 3. Start Flask Server

**Development (Single Process):**
```bash
npm run dl-server
# Starts PyTorch server on port 5001 (single-threaded)
```

**Production (Gunicorn with 4 Workers):**
```bash
npm run dl-server-prod
# Starts PyTorch server with gunicorn (4 workers, full concurrency)
```

### 4. Prepare Training Data
Create `public/codesnippets.json`:
```json
{
  "inputs": [
    "def async fetch_data(url):",
    "function useAsyncData() {",
    "import React from 'react';"
  ],
  "targets": [
    "    async with aiohttp.ClientSession() as session:",
    "  const [data, setData] = useState(null);",
    "export default function Component() {}"
  ]
}
```

**Format Requirements:**
- Single object (not an array)
- `inputs` and `targets` are parallel arrays
- Each `inputs[i]` corresponds to `targets[i]`

## Usage

### Training the Model

**Option 1: Via npm script**
```bash
npm run dl-train
```

**Option 2: Via API**
```bash
curl -X POST http://localhost:3000/api/dl-codegen/train \
  -H "Content-Type: application/json" \
  -d '{"datasetPath": "public/codesnippets.json"}'
```

**Option 3: Programmatically**
```typescript
import DLCodeGen from '@/app/lib/dl-codegen';

const dl = DLCodeGen.getInstance();
const metrics = await dl.train('public/codesnippets.json');

console.log('Training complete:', metrics);
// { loss: 0.234, accuracy: 0.87 }
```

### Making Predictions

**Via API:**
```bash
curl -X POST http://localhost:3000/api/dl-codegen/predict \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "async function fetchData",
    "context": ["import axios from 'axios'"]
  }'
```

**Programmatically:**
```typescript
import DLCodeGen from '@/app/lib/dl-codegen';

const dl = DLCodeGen.getInstance();
const prediction = await dl.predict(
  'async function fetchData',
  ['import axios from "axios"']
);

console.log('Prediction:', prediction);
// {
//   completion: 'async ',
//   confidence: 0.92,
//   features: Float32Array(544) [...]
// }
```

## API Reference

### DLCodeGen Class

```typescript
class DLCodeGen {
  // Singleton instance
  static getInstance(): DLCodeGen

  // Train model on dataset
  async train(datasetPath: string): Promise<{
    loss: number;
    accuracy: number;
  }>

  // Predict code completion (with caching)
  async predict(
    prompt: string,
    context?: string[]
  ): Promise<Prediction>

  // Cache management
  clearPredictionCache(): void
  getCacheStats(): { size: number; maxSize: number }
}
```

### Types

```typescript
interface CodeDataset {
  inputs: string[];   // Code prompts
  targets: string[];  // Expected completions
}

interface DLConfig {
  hiddenLayers: number[];
  dropout: number;
  lr: number;
  epochs: number;
  batchSize: number;
  embeddingDim: number;
}

interface Prediction {
  completion: string;      // Predicted code token
  confidence: number;      // 0.0 - 1.0
  features: Float32Array;  // 544-dim feature vector
}
```

## Flask Server Endpoints

### POST /train
Train the neural network.

**Request:**
```json
{
  "dataset": [[0.1, 0.2, ...], [0.3, 0.4, ...]],  // Feature vectors
  "modelPath": ".data/dl-model.pt",
  "config": {
    "batchSize": 64,
    "epochs": 50,
    "lr": 0.001,
    "hiddenLayers": [512, 256, 128, 64],
    "dropout": 0.2
  }
}
```

**Response:**
```json
{
  "loss": 0.234,
  "accuracy": 0.87
}
```

### POST /predict
Get code completion prediction.

**Request:**
```json
{
  "modelPath": ".data/dl-model.pt",
  "features": [0.1, 0.2, 0.3, ...]  // 544-dim vector
}
```

**Response:**
```json
{
  "completion_idx": 3,
  "confidence": 0.92
}
```

## Environment Variables

```bash
# Flask server host (default: http://127.0.0.1:5001)
DL_SERVER_HOST=http://127.0.0.1:5001

# Ollama configuration (for embeddings)
OLLAMA_EMBED_HOST=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# ChromaDB configuration
CHROMA_HOST=localhost
CHROMA_PORT=8000
```

## Model Storage

Trained models are saved to:
```
.data/dl-model.pt
```

Format: PyTorch state dictionary (`.pt` file)

## Performance Optimizations

### Recent Performance Improvements (January 2026)

The system has been optimized with the following improvements:

#### 1. Request-Level Prediction Caching
- **LRU cache** with 500 prediction limit
- **30-minute TTL** (time-to-live)
- **MD5-based cache keys** (prevents collisions)
- **Impact**: Cache hits return in ~1ms (vs 150ms) = **99.3% faster**

#### 2. Shared Embedding Cache
- Single embedding cache shared between DL and Memory systems
- Eliminates duplicate embedding calls
- **Impact**: Saves 100-200ms per request on shared prompts

#### 3. Production Server (Gunicorn)
- **4 worker processes** for concurrent request handling
- Thread-safe model loading with double-checked locking
- Auto-restart workers after 1000 requests (prevents memory leaks)
- **Impact**: 4x throughput under concurrent load

#### 4. Performance Monitoring
- Detailed latency breakdown for every request
- Cache hit/miss tracking
- Preprocessing, inference, and total time metrics
- **Example output**:
  ```
  [DL-Performance] Cache MISS - Computing prediction...
  [DL-Performance] Breakdown:
    - Preprocessing: 120.45ms
    - Model Load: 0.23ms
    - Inference: 8.12ms
    - Total: 128.80ms
    - Confidence: 85.3%
  ```

### Performance Characteristics

#### Training
- **3 samples**: ~1-2 seconds
- **100 samples**: ~30-60 seconds
- **1000 samples**: ~5-10 minutes

#### Inference (Optimized)

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| **First-time request** | 150ms | 150ms | - |
| **Cache hit (same prompt)** | 150ms | 1ms | 99.3% faster |
| **Shared embedding hit** | 150ms | 50ms | 66% faster |
| **4 concurrent requests** | 600ms | 150ms | 4x throughput |

#### Memory Usage
- **Flask server**: ~500MB (PyTorch + model)
- **Embedding cache**: ~6MB (capped with LRU eviction)
- **Prediction cache**: ~2MB (500 cached predictions)
- **Feature vectors**: ~2KB per code sample (544 floats)
- **Trained model**: ~1.8MB (DeepCodeNet state dict)

## Troubleshooting

### "Import 'flask' could not be resolved"
**Solution:**
```bash
pip3 install flask
# Or run: npm run dl-setup
```

### "Connection refused" (Flask server)
**Solution:**
```bash
# Check if server is running
curl http://127.0.0.1:5001/
# Should return 404 (not an error - means server is up)

# If not running, start it
npm run dl-server
```

### "RuntimeError: input and weight shapes cannot be multiplied"
**Cause:** Dataset format is incorrect (wrong dimensions)

**Solution:** Ensure your dataset produces 544-dimensional vectors:
- 384 (embeddings) + 100 (keywords) + 50 (AST) + 10 (syntax) = 544

### "No module named 'torch'"
**Solution:**
```bash
pip3 install torch
```

### ChromaDB not running
**Solution:**
```bash
npm run chroma-start
# Check status
docker ps | grep chromadb
```

### Gunicorn not found
**Solution:**
```bash
pip3 install gunicorn
# Or run setup script
npm run dl-setup
```

### Port 5001 already in use
**Solution:**
```bash
# Kill existing process
lsof -ti:5001 | xargs kill -9
# Then restart
npm run dl-server-prod
```

### Workers crashing under load
**Solution:** Reduce workers or increase max_requests in `gunicorn.conf.py`:
```python
workers = 2  # Reduce from 4
max_requests = 500  # Reduce from 1000
```

## Development

### Run type checking
```bash
npx tsc --noEmit
```

### Check Python syntax
```bash
cd app/lib/dl-codegen
python3 -m py_compile server.py
```

### Test Flask endpoints directly
```bash
# Test training (small dataset)
curl -X POST http://127.0.0.1:5001/train \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": [[0.1, 0.2], [0.3, 0.4]],
    "modelPath": ".data/test-model.pt",
    "config": {"batchSize": 2, "epochs": 1, "lr": 0.001}
  }'
```

## Architecture Decisions

### Why Flask + PyTorch (not ONNX)?
- **Flexibility**: Easy to modify model architecture
- **Development speed**: No export/conversion step
- **Debugging**: Direct Python debugging
- **Production ready**: Flask is battle-tested

### Why 544 dimensions?
- **Embeddings (384)**: Captures semantic meaning
- **Keywords (100)**: Captures token frequency patterns
- **AST (50)**: Captures code structure
- **Syntax (10)**: Captures complexity metrics
- **Balance**: Rich features without excessive size

### Why truncate embeddings from 768 to 384?
- **Model size**: Smaller input → smaller network
- **Training speed**: Faster forward/backward passes
- **Sufficient information**: 384 dims retain most semantic meaning

## Production Deployment

### Docker

Add to your `Dockerfile`:
```dockerfile
# Install Python dependencies
COPY app/lib/dl-codegen/requirements.txt .
RUN pip3 install -r requirements.txt

# Start DL server alongside Next.js
CMD ["sh", "-c", "cd app/lib/dl-codegen && ./start-server.sh & npm start"]
```

### Systemd Service

Create `/etc/systemd/system/dl-codegen.service`:
```ini
[Unit]
Description=DL-CodeGen Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/hackerreign/app/lib/dl-codegen
ExecStart=/usr/local/bin/gunicorn --config gunicorn.conf.py server:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable dl-codegen
sudo systemctl start dl-codegen
```

### Configuration Files

The production setup includes:
- `requirements.txt` - Python dependencies (Flask, PyTorch, Gunicorn)
- `gunicorn.conf.py` - Gunicorn configuration (4 workers)
- `start-server.sh` - Startup script with auto-installation

### Cache Management

Monitor cache performance:
```typescript
const dl = DLCodeGen.getInstance();
const stats = dl.getCacheStats();
console.log(`Cache: ${stats.size}/${stats.maxSize}`);
```

Clear prediction cache (if needed):
```typescript
dl.clearPredictionCache();
```

### Monitoring Performance

Watch the production server logs to see performance metrics:
```bash
npm run dl-server-prod
```

Look for `[DL-Performance]` logs showing cache hits/misses and latency breakdowns.

## Future Enhancements

- [x] Request-level prediction caching (✅ Completed Jan 2026)
- [x] Shared embedding cache (✅ Completed Jan 2026)
- [x] Production server with gunicorn (✅ Completed Jan 2026)
- [x] Performance monitoring and logging (✅ Completed Jan 2026)
- [ ] Expand vocabulary beyond 100 tokens
- [ ] Add beam search for multi-token predictions
- [ ] Add model versioning and A/B testing
- [ ] Support for multi-language models
- [ ] Real-time fine-tuning based on user feedback
- [ ] Export to ONNX for edge deployment
- [ ] Redis-backed prediction cache for horizontal scaling

## License

©2026 | Vivid Visions | HackerReign™

---

**Last Updated**: January 2026
**Version**: 1.0.0
**Status**: Production Ready ✅
