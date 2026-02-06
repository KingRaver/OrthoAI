# Optimization Audit

Date: 2026-02-05
Scope: Next.js app, API routes, memory/RAG pipeline, voice stack, and DL-codegen modules.
Method: Static review of repo code. No runtime profiling or load tests were executed.

## Executive Summary
- The largest user-facing wins come from reducing client bundle size and re-render churn, especially around voice and 3D rendering.
- The most impactful backend improvements are in the RAG pipeline (avoid N+1 SQLite queries, enforce token budgets, and prevent repeat FTS backfills).
- The STT/TTS routes spawn new processes and use sync file I/O on every request, which is a major latency and scalability limiter.
- Several hot loops and heavy logging paths can be gated or throttled to prevent UI jank and server CPU spikes.
- Memory summarization currently scans full conversations, which becomes expensive as histories grow.
- A small set of structural changes can unlock measurable latency and memory gains without changing product behavior.

## Priority Matrix
| Priority | Area | Recommendation | Expected Impact | Effort |
| --- | --- | --- | --- | --- |
| P0 | Client | Lazy-load voice + 3D stack and gate AudioContext creation | Large bundle and CPU reduction | Medium |
| P0 | RAG | Remove N+1 SQLite lookups during retrieval | Large latency reduction under load | Medium |
| P0 | STT/TTS | Replace per-request process spawn and sync I/O with persistent workers | Large latency and CPU improvement | High |
| P1 | Memory | Enforce `RAG_TOKEN_BUDGET` and limit memory context | Lower LLM latency and cost | Medium |
| P1 | Storage | Track applied migrations to avoid repeated FTS backfills | Faster startup on large DBs | Medium |
| P1 | Client | Throttle audio/beat state updates to reduce React re-render rate | Smoother UI on laptops | Low |
| P2 | LLM | Add bounded timeouts and cancellation defaults | Better stability | Low |
| P2 | Chain/Ensemble | Reuse computed context across chain steps | Moderate latency reduction | Low |

## Findings and Recommendations

## Client Performance

### F1. Lazy-load the voice and 3D stack
Evidence: `components/Chat.tsx`, `components/ParticleOrb.tsx`, `app/lib/voice/useVoiceFlow.ts`, `app/lib/voice/useVoiceOutput.ts`.
Impact: The current client bundle includes `three` and the voice stack even when voice mode is off. `useVoiceOutput` creates an `AudioContext` on mount, which is heavy and can trigger autoplay restrictions.
Recommendation: Dynamically import `ParticleOrb` and the voice hooks only when voice mode is enabled. Gate AudioContext creation until voice is explicitly turned on. Consider a separate `VoicePanel` component that is loaded on demand.

### F2. Reduce render churn from audio updates
Evidence: `app/lib/voice/useVoiceInput.ts`, `app/lib/voice/useVoiceFlow.ts`, `app/lib/voice/useVoiceOutput.ts`, `components/Chat.tsx`.
Impact: Audio level and frequency updates happen every animation frame and update React state, which re-renders large portions of the UI. This is a common source of UI jank.
Recommendation: Store audio levels in refs and only sync to state at a lower rate (for example, 10 to 20 fps). Alternatively, isolate the orb into a component that reads from a `useSyncExternalStore` or a custom event emitter to avoid re-rendering the chat list.

### F3. Virtualize or window the message list
Evidence: `components/Chat.tsx`.
Impact: Each new message or streaming chunk causes a full list render, and `ReactMarkdown` parsing is repeated for every item. This scales poorly with long conversations.
Recommendation: Use a windowing library or a simple manual virtualization strategy. Memoize message rendering and move markdown parsing into a memoized component keyed by message id and content.

### F4. Throttle scroll-to-bottom during streaming
Evidence: `components/Chat.tsx`.
Impact: `scrollIntoView({ behavior: 'smooth' })` on every state change can cause layout thrashing during streaming updates.
Recommendation: Trigger auto-scroll only on new message boundaries or throttle updates using `requestAnimationFrame`.

### F5. Optimize the 3D particle loop
Evidence: `components/ParticleOrb.tsx`.
Impact: Per-particle calculations and random forces run on every frame for 1000 particles. This is GPU and CPU heavy on mobile and laptops.
Recommendation: Reduce particle count on low-power devices. Avoid per-frame `Math.random()` by precomputing jitter values. Consider a shader-based approach or a static mesh with simple scale and color changes.

## LLM Pipeline and API

### F6. Remove N+1 lookups in RAG retrieval
Evidence: `app/lib/memory/rag/retrieval.ts`.
Impact: Each result from Chroma triggers a separate SQLite query to fetch the full message. This is a classic N+1 performance problem and becomes slow as `topK` grows.
Recommendation: Fetch messages in a single query using `SELECT * FROM messages WHERE id IN (...)`. Alternatively, store the message content and metadata in Chroma and avoid round-trips for common fields.

### F7. Enforce token budgets for memory context
Evidence: `app/lib/memory/config.ts`, `app/lib/memory/rag/index.ts`.
Impact: `RAG_TOKEN_BUDGET` is configured but not enforced in prompt assembly, which can lead to very long prompts and higher LLM latency.
Recommendation: Implement a token budget estimator and trim memory context to the budget. Favor summaries and highest-similarity items first.

### F8. Avoid re-running FTS backfill on every startup
Evidence: `app/lib/memory/storage/sqlite.ts`, `app/lib/memory/migrations/007_fts_triggers.sql`.
Impact: `SQLiteStorage.initialize` runs all migrations each time. The FTS backfill `INSERT OR IGNORE` scans all messages on every boot, which becomes expensive for large stores.
Recommendation: Track applied migrations in a `schema_migrations` table or use `PRAGMA user_version` to only run new migrations. Move the backfill into a one-time migration or guard it with a stored flag.

### F9. Summaries should not load full conversations
Evidence: `app/lib/memory/index.ts`.
Impact: `getConversationMessages` loads all messages then slices the last 10. For long conversations this is costly and unnecessary.
Recommendation: Add a `getConversationMessages` method that accepts `limit` and `order` to fetch only the last N rows directly in SQL.

### F10. Limit concurrent background embedding and summary work
Evidence: `app/lib/memory/index.ts` and `app/lib/memory/rag/index.ts`.
Impact: Each message triggers async embedding and optional summary generation. Under high throughput this can create unbounded concurrency and CPU spikes.
Recommendation: Use a simple in-process queue or a worker thread to cap concurrency. Add a backoff when the embedding server is slow or unavailable.

### F11. Add bounded timeouts for long LLM requests
Evidence: `instrumentation.ts`, `app/api/llm/route.ts`.
Impact: Global undici timeouts are disabled and OpenAI client timeouts are set to 1 hour. This can exhaust server resources if requests hang.
Recommendation: Provide a sane default timeout (for example 10 to 20 minutes) with an env override. Log request durations and enforce cancellation on user abort.

## Voice, STT, and TTS

### F12. Replace per-request STT process spawning
Evidence: `app/api/stt/route.ts`.
Impact: Each request writes to disk, spawns Whisper, waits for completion, and then deletes files. This is high overhead and blocks the Node event loop with sync I/O.
Recommendation: Run a persistent STT service (faster-whisper, whisper.cpp, or a local server) and stream audio to it. Switch to async `fs.promises` or streaming writes for large files.

### F13. Replace per-request Piper TTS process spawning
Evidence: `app/api/piper-tts/route.ts`.
Impact: Each TTS request spawns Python, loads models, writes to disk, and reads the output back. This is costly and does not scale.
Recommendation: Keep a persistent Piper server or a worker process with model preloaded. Prefer in-memory pipes to avoid disk I/O.

## RAG and Retrieval Quality

### F14. Reranking re-parses every result
Evidence: `app/lib/memory/rag/rerank.ts`.
Impact: `extractCodeIdentifiers` runs for every retrieval result, repeatedly scanning text with regex. This can be expensive when the result set grows.
Recommendation: Cache extracted identifiers per message, or precompute identifiers at message ingest and store them in metadata for quick lookup.

### F15. Avoid including unused data in Chroma queries
Evidence: `app/lib/memory/rag/retrieval.ts`.
Impact: `collection.query` includes embeddings, documents, and metadatas even when some fields are unused, which increases payload size.
Recommendation: Request only the needed fields to reduce memory and network overhead.

## DL Codegen

### F16. Batch embeddings for dataset preprocessing
Evidence: `app/lib/dl-codegen/preprocess.ts`.
Impact: Embeddings are generated sequentially for each input. This makes training data preprocessing slow for large datasets.
Recommendation: Use `embedBatch` when processing multiple inputs and parallelize feature extraction where safe.

### F17. Avoid JSON serialization of large training data
Evidence: `app/lib/dl-codegen/train.ts`.
Impact: Converting large Float32 arrays to JSON is slow and memory intensive.
Recommendation: Move to a binary format, use a shared file path, or stream the dataset to the training server.

## Observability and Guardrails

### F18. Guard verbose logs in hot paths
Evidence: `components/Chat.tsx`, `app/lib/voice/*`, `app/lib/strategy/*`, `app/lib/memory/*`.
Impact: `console.log` in hot paths adds overhead and can leak sensitive data. It also impacts performance in production builds.
Recommendation: Gate logs behind a `DEBUG_*` flag or a lightweight logger with levels.

### F19. Track key performance metrics
Recommendation: Add metrics for client render time, LLM latency, embedding queue depth, and STT/TTS duration. Use the existing retrieval metrics pattern as a blueprint.

## Suggested Roadmap

### Phase 1 (1 to 2 days)
- Lazy-load voice and 3D modules, and gate AudioContext creation.
- Throttle audio state updates and reduce re-render churn.
- Add token budget enforcement for memory context.
- Remove N+1 message lookups in retrieval.

### Phase 2 (3 to 5 days)
- Add migration tracking to avoid FTS backfill on every boot.
- Add SQL query variants to fetch only the last N messages.
- Add a bounded background queue for embeddings and summaries.

### Phase 3 (1 to 2 weeks)
- Replace STT/TTS per-request spawning with persistent services.
- Improve DL codegen preprocessing and training data transport.

## Metrics to Validate Improvements
- Client initial JS size and hydration time.
- Average LLM response latency and timeout rate.
- RAG retrieval latency and result count.
- CPU usage during voice mode.
- STT and TTS end-to-end latency.

## File References
- `components/Chat.tsx`
- `components/ParticleOrb.tsx`
- `app/lib/voice/useVoiceFlow.ts`
- `app/lib/voice/useVoiceInput.ts`
- `app/lib/voice/useVoiceOutput.ts`
- `app/api/llm/route.ts`
- `app/api/stt/route.ts`
- `app/api/piper-tts/route.ts`
- `app/lib/memory/rag/retrieval.ts`
- `app/lib/memory/rag/index.ts`
- `app/lib/memory/rag/rerank.ts`
- `app/lib/memory/index.ts`
- `app/lib/memory/storage/sqlite.ts`
- `app/lib/dl-codegen/preprocess.ts`
- `app/lib/dl-codegen/train.ts`

---

## Additional Deep-Dive Findings (Appended 2026-02-05)

The following findings extend the original audit with deeper code-level observations from comprehensive static analysis.

### Priority Matrix (Extended)

| Priority | Area | Recommendation | Expected Impact | Effort |
| --- | --- | --- | --- | --- |
| P0 | Strategy | Replace Jaccard with semantic similarity for ensemble voting | Higher quality consensus | Medium |
| P0 | Memory | Batch message retrieval in single IN clause query | Large latency reduction | Low |
| P1 | Voice | Replace deprecated ScriptProcessorNode with AudioWorklet | Future-proof, better performance | Medium |
| P1 | Strategy | Cache theme detection results per conversation turn | Reduce redundant ML inference | Low |
| P1 | Learning | Increase parameter tuner complexity bucket resolution | Better learned parameters | Low |
| P2 | DL-CodeGen | Persist model in memory instead of loading per prediction | Faster inference | Medium |
| P2 | RAG | Implement connection pooling for Chroma client | Better concurrency | Medium |
| P2 | Memory | Stream summary generation instead of blocking | Lower perceived latency | Medium |

---

## Strategy and Orchestration

### F20. Ensemble uses Jaccard (lexical) similarity instead of semantic matching

**Evidence:** [ensemble.ts:144-161](app/lib/strategy/workflows/ensemble.ts#L144-L161)

```typescript
private static jaccardSimilarity(a: string, b: string): number {
  const aSet = this.tokenize(a);
  const bSet = this.tokenize(b);
  // ...word-based intersection/union
}
```

**Impact:** Jaccard similarity measures word overlap, not semantic meaning. Two responses with different wording but same meaning will have low similarity scores, potentially selecting suboptimal consensus.

**Recommendation:** Use cosine similarity on embeddings from the shared embedding instance. This provides semantic matching and leverages existing infrastructure:
```typescript
const embA = await embeddings.embed(a);
const embB = await embeddings.embed(b);
const similarity = cosineSimilarity(embA, embB);
```

---

### F21. Chain workflow executes steps strictly sequentially

**Evidence:** [chain.ts:34-68](app/lib/strategy/workflows/chain.ts#L34-L68)

```typescript
for (let i = 0; i < config.steps.length; i++) {
  const step = config.steps[i];
  const stepResult = await this.executeChainStep(...);
  // ...
}
```

**Impact:** Each chain step (draft → refine → validate → review) waits for the previous step. For independent validation steps (e.g., separate critique and review passes), this adds unnecessary latency.

**Recommendation:** Mark chain steps as `parallel: boolean` in config. Run independent steps concurrently with `Promise.all()`, then merge results. Maintain sequential execution only for dependent steps.

---

### F22. Theme detection runs synchronously on every LLM request

**Evidence:** [workflowStrategy.ts:24-26](app/lib/strategy/implementations/workflowStrategy.ts#L24-L26)

```typescript
const themeDetection = await patternRecognizer.detectTheme(context.userMessage);
```

**Impact:** Pattern recognition inference adds latency to every request, even for follow-up messages in the same conversation where the theme is unlikely to change.

**Recommendation:** Cache theme detection per conversation with a short TTL (e.g., 30 seconds or until user message content significantly changes). Only re-detect on conversation boundary or topic shift heuristics.

---

### F23. Combined workflow always runs both ensemble AND chain

**Evidence:** [orchestrator.ts:22-53](app/lib/strategy/orchestrator.ts#L22-L53)

```typescript
if (decision.modelChain?.enabled && decision.ensembleConfig?.enabled) {
  // Always runs ensemble THEN chain
}
```

**Impact:** Simple queries that don't benefit from multi-model consensus still go through the full ensemble + chain pipeline, adding 3-5x latency compared to single-model inference.

**Recommendation:** Introduce a `complexity_threshold` that bypasses the combined workflow for low-complexity queries (complexity < 30). Use single-model inference for quick responses, reserve combined workflow for complex or critical queries.

---

## Learning System

### F24. Parameter tuner uses only 3 complexity buckets

**Evidence:** [parameterTuner.ts:90-91](app/lib/learning/parameterTuner.ts#L90-L91)

```typescript
// Bucket complexity into ranges (0-33, 34-66, 67-100)
const complexityBucket = Math.floor(complexity / 34);
```

**Impact:** Coarse buckets (only 3) reduce parameter learning precision. A complexity score of 35 uses the same learned parameters as 65.

**Recommendation:** Increase to 5-10 buckets (e.g., `Math.floor(complexity / 10)` for 10 buckets). This provides finer-grained parameter optimization while still aggregating enough samples per bucket.

---

### F25. Learned profiles require minimum 3 samples before use

**Evidence:** [parameterTuner.ts:114-126](app/lib/learning/parameterTuner.ts#L114-L126)

```typescript
if (profile && profile.sampleSize >= 3) {
  return { /* learned parameters */ };
}
// Otherwise return heuristic-based defaults
```

**Impact:** New theme/complexity combinations always start with heuristics, even if adjacent profiles have strong signal.

**Recommendation:** Implement weighted interpolation from adjacent buckets when exact match has insufficient samples. Use Bayesian prior from similar themes.

---

## Memory and RAG

### F26. Embedding cache has fixed 1000-entry limit with simple LRU eviction

**Evidence:** [embeddings.ts:15-19](app/lib/memory/rag/embeddings.ts#L15-L19), [embeddings.ts:159-165](app/lib/memory/rag/embeddings.ts#L159-L165)

```typescript
private maxCacheSize: number = 1000;

private addToCache(key: string, value: number[]): void {
  if (this.cache.size >= this.maxCacheSize) {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) this.cache.delete(firstKey);
  }
  this.cache.set(key, value);
}
```

**Impact:** For applications with diverse queries, the 1000-entry limit may cause frequent cache misses. The Map-based LRU relies on insertion order, which may not reflect actual usage patterns.

**Recommendation:** Make cache size configurable via environment variable. Consider a true LRU implementation that tracks access time, or use a time-based expiry for stale entries.

---

### F27. Conversation summary generation makes inline LLM call

**Evidence:** [index.ts:197-274](app/lib/memory/index.ts#L197-L274)

```typescript
async generateConversationSummary(conversationId: string): Promise<void> {
  // ...
  const response = await fetch(getLlmChatUrl(), {
    // ...blocking LLM call
  });
}
```

**Impact:** Summary generation happens synchronously after every N assistant messages, adding latency to those responses.

**Recommendation:** Move summary generation to a background job queue with its own concurrency limit. Fire-and-forget pattern allows the user request to complete immediately while summary is generated asynchronously.

---

### F28. Chroma retrieval fetches unused embedding data

**Evidence:** [retrieval.ts:219](app/lib/memory/rag/retrieval.ts#L219)

```typescript
include: ['embeddings', 'distances', 'documents', 'metadatas'],
```

**Impact:** Including 'embeddings' in the response transfers 384-dimensional float arrays for each result, which are not used after retrieval.

**Recommendation:** Remove 'embeddings' from include array unless they're needed for downstream processing:
```typescript
include: ['distances', 'documents', 'metadatas'],
```

---

### F29. FTS search escapes special characters but may miss edge cases

**Evidence:** [retrieval.ts:491-496](app/lib/memory/rag/retrieval.ts#L491-L496)

```typescript
const ftsQuery = query
  .replace(/[^\w\s]/g, ' ')  // Remove special chars
  .trim()
  .split(/\s+/)               // Split on whitespace
  .filter(term => term.length > 2)  // Filter short terms
  .join(' OR ');              // Join with OR
```

**Impact:** Medical terms with hyphens (e.g., "ACL-reconstruction", "T1-weighted") get split and may produce unexpected FTS results. Short important terms like "MRI", "ACL" are filtered out.

**Recommendation:** Preserve hyphenated compound terms. Lower the minimum term length to 2 characters for medical abbreviations. Consider a medical-aware tokenizer.

---

## Voice System

### F30. ScriptProcessorNode is deprecated

**Evidence:** [audioRecorder.ts:129-130](app/lib/voice/audioRecorder.ts#L129-L130)

```typescript
const processor = audioContext.createScriptProcessor(4096, 1, 1);
```

**Impact:** `ScriptProcessorNode` is deprecated in favor of `AudioWorkletNode`. Browsers may remove support, and it runs on the main thread causing potential UI jank.

**Recommendation:** Migrate to `AudioWorkletNode` for audio processing. This runs in a separate thread and is the modern standard for real-time audio.

---

### F31. WebM to WAV conversion runs on every STT request

**Evidence:** [useVoiceInput.ts:224](app/lib/voice/useVoiceInput.ts#L224)

```typescript
const wavBlob = await webmToWav(webmBlob);
```

**Impact:** Every voice input goes through WebM decode → Float32 conversion → WAV encode, which involves AudioContext creation and array copying.

**Recommendation:** Record directly in WAV format using the AudioContextRecorder, bypassing the WebM → WAV conversion entirely. This reduces CPU and memory overhead.

---

### F32. Silence detection thresholds are hardcoded

**Evidence:** [useVoiceInput.ts:144-146](app/lib/voice/useVoiceInput.ts#L144-L146)

```typescript
const SILENCE_SENSITIVITY = 0.005; // Audio level threshold for silence (0.5%)
const SPEECH_START_THRESHOLD = 0.015; // Require 1.5% level to confirm speech started
const FRAMES_FOR_SILENCE = Math.ceil(silenceThresholdMs / 50);
```

**Impact:** Fixed thresholds may not work well across different microphones, environments, or users with varying voice volumes.

**Recommendation:** Implement adaptive thresholding based on initial calibration or running average of ambient noise. Allow user configuration for sensitivity.

---

## DL CodeGen

### F33. Model path is passed but model is loaded on every prediction

**Evidence:** [model.ts:7-11](app/lib/dl-codegen/model.ts#L7-L11)

```typescript
export async function loadModel(modelPath: string): Promise<string> {
  // Flask server loads model on-demand during prediction
  // Just return the model path for the predict call
  return modelPath;
}
```

**Impact:** Despite prediction caching in [index.ts](app/lib/dl-codegen/index.ts), the Flask server may reload the model on each prediction request if it doesn't maintain state.

**Recommendation:** Ensure the Flask server uses a singleton model loader that keeps the PyTorch model in GPU/CPU memory. Add a `/health` endpoint to verify model is loaded.

---

### F34. Vocabulary mapping is limited to 9 tokens

**Evidence:** [model.ts:47-50](app/lib/dl-codegen/model.ts#L47-L50)

```typescript
function decodePrediction(idx: number): string {
  const vocab = ['def ', 'async ', 'function ', 'import ', 'class ', 'return', 'if ', 'for ', 'while'];
  return vocab[idx] || '';
}
```

**Impact:** The hardcoded vocabulary severely limits code completion capabilities.

**Recommendation:** Load vocabulary from a `vocab.json` file generated during training. This allows the vocabulary to grow with the model without code changes.

---

## General Architecture

### F35. Multiple singleton instances lack cleanup hooks

**Evidence:** Various files including:
- [index.ts:433-443](app/lib/memory/index.ts#L433-L443) - `memoryManagerInstance`
- [embeddings.ts:184-197](app/lib/memory/rag/embeddings.ts#L184-L197) - `sharedEmbeddingsInstance`
- [manager.ts:98-99](app/lib/strategy/manager.ts#L98-L99) - `strategyManager`
- [parameterTuner.ts:366-367](app/lib/learning/parameterTuner.ts#L366-L367) - `parameterTuner`

**Impact:** No graceful shutdown handlers for database connections, pending async work, or AudioContext cleanup. This can cause resource leaks in long-running processes and incomplete writes on termination.

**Recommendation:** Implement a shutdown registry that tracks all singleton instances. Register cleanup handlers with `process.on('SIGTERM', ...)` and `process.on('SIGINT', ...)`.

---

### F36. Memory manager initialization is lazy but blocking

**Evidence:** [index.ts:61-73](app/lib/memory/index.ts#L61-L73)

```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;
  await this.storage.initialize();
  await this.rag.initialize();
  this.initialized = true;
}
```

**Impact:** First request that uses memory will block while SQLite migrations run and Chroma connection is established.

**Recommendation:** Initialize memory system during app startup (e.g., in `instrumentation.ts` or a Next.js middleware) rather than on first request. Add startup health checks to verify all systems are ready.

---

## Updated Roadmap (Integrated)

### Phase 1 (1-2 days) — Quick Wins
- ✓ Lazy-load voice and 3D modules, gate AudioContext creation
- ✓ Throttle audio state updates and reduce re-render churn
- ✓ Add token budget enforcement for memory context
- **NEW:** Remove 'embeddings' from Chroma query includes (F28)
- **NEW:** Cache theme detection per conversation (F22)
- **NEW:** Fix FTS query to preserve medical abbreviations (F29)

### Phase 2 (3-5 days) — Core Performance
- ✓ Add migration tracking to avoid FTS backfill
- ✓ Add SQL query variants for last N messages
- ✓ Add bounded background queue for embeddings/summaries
- **NEW:** Replace Jaccard with semantic similarity in ensemble (F20)
- **NEW:** Add complexity threshold to bypass combined workflow (F23)
- **NEW:** Increase parameter tuner bucket resolution (F24)

### Phase 3 (1-2 weeks) — Infrastructure
- ✓ Replace STT/TTS per-request spawning with persistent services
- ✓ Improve DL codegen preprocessing and training data transport
- **NEW:** Migrate to AudioWorkletNode (F30)
- **NEW:** Load vocabulary from config file (F34)
- **NEW:** Implement shutdown registry for singletons (F35)

### Phase 4 (Future) — Advanced
- Implement parallel chain steps for independent operations (F21)
- Adaptive silence detection thresholds (F32)
- Direct WAV recording bypass (F31)
- Bayesian parameter interpolation for sparse profiles (F25)

---

## Metrics to Validate Improvements (Extended)

| Metric | Baseline Target | Measurement Point |
| --- | --- | --- |
| Client initial JS size | < 500KB gzipped | Build output analysis |
| Hydration time | < 100ms | Performance.mark() |
| LLM response latency (P95) | < 15s simple, < 60s complex | API route timing |
| RAG retrieval latency (P95) | < 200ms | Retrieval metrics log |
| Ensemble voting accuracy | > 85% agreement | Consensus confidence |
| Theme cache hit rate | > 70% | Cache stats endpoint |
| STT end-to-end latency | < 3s for 10s audio | API route timing |
| TTS end-to-end latency | < 2s for 200 chars | API route timing |
| Memory usage (idle) | < 512MB | Process metrics |
| Memory usage (under load) | < 2GB | Process metrics |

---

## Extended File References
- `app/lib/strategy/orchestrator.ts`
- `app/lib/strategy/workflows/chain.ts`
- `app/lib/strategy/workflows/ensemble.ts`
- `app/lib/strategy/manager.ts`
- `app/lib/strategy/implementations/workflowStrategy.ts`
- `app/lib/learning/parameterTuner.ts`
- `app/lib/learning/patternRecognition.ts`
- `app/lib/dl-codegen/index.ts`
- `app/lib/dl-codegen/model.ts`
- `app/lib/voice/audioRecorder.ts`
- `app/lib/memory/config.ts`
