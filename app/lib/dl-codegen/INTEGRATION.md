# Deep Learning Integration with LLM Pipeline

This document describes how the deep learning neural network is integrated into the main LLM inference pipeline.

## Integration Point

The DL code generation system is integrated into [app/api/llm/route.ts](../../api/llm/route.ts) between memory augmentation and LLM inference.

## Data Flow

```
User Message
    ↓
Memory Augmentation (retrieve past context)
    ↓
DL Neural Network Prediction ← YOU ARE HERE
    ↓
Enhanced System Prompt (with DL suggestion)
    ↓
Ollama LLM Inference
    ↓
Response to User
```

## How It Works

### 1. Extract Context
```typescript
// Get last 3 assistant messages as context
const contextMessages = messages.slice(-3)
  .filter((m: any) => m.role === 'assistant')
  .map((m: any) => m.content);
```

### 2. Call DL Prediction API
```typescript
const dlResponse = await fetch('http://localhost:3000/api/dl-codegen/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: lastUserMessage.content,
    context: contextMessages
  })
});
```

### 3. Process Prediction
```typescript
const dlResult = await dlResponse.json();
// {
//   success: true,
//   prediction: {
//     completion: 'async ',
//     confidence: 0.92,
//     features: Float32Array(544)
//   },
//   confidence: 'high'
// }
```

### 4. Inject into System Prompt (if confident)
```typescript
if (dlResult.success && dlResult.prediction.confidence > 0.5) {
  dlSuggestion = dlResult.prediction.completion;

  // Add to system prompt
  systemPrompt += `\n\n[Neural Network Code Suggestion: "${dlSuggestion}" - Consider this if relevant to the user's request]`;
}
```

## Configuration

### Enable/Disable DL Predictions

**Default:** Enabled

**Disable via environment variable:**
```bash
export ENABLE_DL_PREDICTIONS=false
```

**In `.env.local`:**
```bash
ENABLE_DL_PREDICTIONS=false
```

### Confidence Threshold

The system only uses predictions with confidence > 0.5 (50%).

To adjust, modify line 118 in [app/api/llm/route.ts](../../api/llm/route.ts):
```typescript
if (dlResult.success && dlResult.prediction.confidence > 0.7) {
  // Requires 70% confidence
}
```

## Integration Benefits

### 1. Context-Aware Predictions
The DL system sees:
- Current user prompt
- Last 3 assistant responses (conversation context)

This allows it to understand the ongoing conversation and make relevant suggestions.

### 2. Non-Blocking
DL prediction failures don't break the LLM pipeline:
```typescript
try {
  // Get DL prediction
} catch (error) {
  console.warn('[DL] Error getting prediction:', error);
  // Continue without DL augmentation
}
```

### 3. Graceful Degradation
- If DL server is down → LLM continues normally
- If confidence < 50% → DL suggestion ignored
- If prediction fails → Logged as warning, not error

### 4. Logging & Debugging
```typescript
console.log('[DL] Neural network suggestion:', dlSuggestion,
           `(confidence: ${(dlResult.prediction.confidence * 100).toFixed(1)}%)`);
```

Example output:
```
[DL] Neural network suggestion: async  (confidence: 92.3%)
```

## Example Flow

### User Message:
```
"Write a function to fetch data from an API"
```

### DL Prediction:
```json
{
  "completion": "async ",
  "confidence": 0.92
}
```

### Enhanced System Prompt:
```
You are Hacker Reign - a helpful, knowledgeable AI coding expert.

[Memory Context: Previous discussions about async patterns...]

[Neural Network Code Suggestion: "async " - Consider this if relevant to the user's request]

CRITICAL OUTPUT FORMAT RULES:
- NO markdown syntax...
```

### LLM Response:
```
Here's an async function to fetch data from an API:

async function fetchData(url) {
  const response = await fetch(url);
  return await response.json();
}

This uses the async keyword as suggested, which makes handling promises easier.
```

## Monitoring

### Success Indicators
```bash
# In server logs
[DL] Neural network suggestion: async  (confidence: 92.3%)
```

### Failure Indicators
```bash
# DL server down
[DL] Error getting neural network prediction: fetch failed

# Low confidence (no injection)
[DL] Neural network suggestion: def  (confidence: 32.1%)
# Note: Not injected because < 50%
```

## Performance Impact

### Latency Added
- **Preprocessing**: 50-200ms (Ollama embeddings)
- **Prediction**: 5-10ms (PyTorch forward pass)
- **Total**: ~60-210ms added to request

### Comparison
```
Without DL:
User → Memory → LLM → Response
       100ms    2000ms  = 2.1s

With DL:
User → Memory → DL → LLM → Response
       100ms    150ms  2000ms  = 2.25s
```

**Impact**: ~7% increase in latency for intelligent code suggestions.

## Testing

### Test DL Integration
```bash
# 1. Start all services
npm run chroma-start
npm run dl-server
npm run dev

# 2. Make a request
curl -X POST http://localhost:3000/api/llm \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:7b-instruct-q5_K_M",
    "messages": [
      {"role": "user", "content": "Write an async function to fetch data"}
    ],
    "stream": false
  }'

# 3. Check logs for DL prediction
# Should see: [DL] Neural network suggestion: async  (confidence: X.X%)
```

### Test Without DL
```bash
# Disable DL predictions
export ENABLE_DL_PREDICTIONS=false

# Make request (should work normally without DL)
curl -X POST http://localhost:3000/api/llm ...
```

### Test DL Failure Handling
```bash
# Stop Flask server
pkill -f "python3 server.py"

# Make request (should work, logs warning)
curl -X POST http://localhost:3000/api/llm ...

# Check logs
# Should see: [DL] Error getting neural network prediction: ...
# LLM should still respond normally
```

## Troubleshooting

### "DL predictions not showing in logs"

**Check:**
1. Is Flask server running?
   ```bash
   curl http://127.0.0.1:5001/
   # Should return 404 (server is up)
   ```

2. Is DL enabled?
   ```bash
   echo $ENABLE_DL_PREDICTIONS
   # Should be empty or "true"
   ```

3. Is model trained?
   ```bash
   ls -lh .data/dl-model.pt
   # Should exist
   ```

### "DL predictions always ignored (low confidence)"

**Cause:** Model not trained or trained on insufficient data

**Solution:**
```bash
# Train with more data
npm run dl-train

# Check training metrics
# Loss should be < 1.0, Accuracy > 0.7
```

### "DL predictions breaking LLM response"

**This shouldn't happen!** DL is wrapped in try-catch and failures are non-blocking.

**Debug:**
1. Check error logs for `[DL] Error`
2. Temporarily disable DL: `ENABLE_DL_PREDICTIONS=false`
3. Report issue if LLM breaks (this is a bug)

## Advanced Configuration

### Custom Prediction Endpoint

Modify [app/api/llm/route.ts](../../api/llm/route.ts) line 107:
```typescript
const dlResponse = await fetch('http://localhost:3000/api/dl-codegen/predict', {
  // Change to custom endpoint
});
```

### More Context Messages

Include more conversation history (line 103):
```typescript
const contextMessages = messages.slice(-5)  // Last 5 instead of 3
  .filter((m: any) => m.role === 'assistant')
  .map((m: any) => m.content);
```

### Multiple Predictions

Request multiple predictions and rank them:
```typescript
// Make multiple calls with different temperatures
const predictions = await Promise.all([
  fetchPrediction(prompt, context, temp=0.5),
  fetchPrediction(prompt, context, temp=0.7),
  fetchPrediction(prompt, context, temp=0.9)
]);

// Use the highest confidence prediction
const best = predictions.sort((a, b) =>
  b.confidence - a.confidence
)[0];
```

## Future Enhancements

- [ ] Cache predictions for identical prompts
- [ ] A/B test with/without DL suggestions
- [ ] Track which suggestions LLM uses
- [ ] Fine-tune on user feedback
- [ ] Multi-token predictions (beam search)
- [ ] Prediction explanations (why this suggestion?)

## Related Documentation

- [DL System Overview](README.md)
- [Flask Server API](README.md#flask-server-endpoints)
- [Training Guide](README.md#training-the-model)
- [Memory System](../memory/README.md)

---

**Last Updated**: January 2026
**Integration Status**: ✅ Active
