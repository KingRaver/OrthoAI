# Quick Test Script

## Test the fixes immediately:

```bash
# 1. Restart the dev server (in a new terminal)
npm run dev

# 2. Test Piper TTS directly
curl -X POST http://localhost:3000/api/piper-tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of the optimized voice system."}' \
  --output /tmp/test-speech.wav

# Check if it worked
ls -lh /tmp/test-speech.wav
# Play it (macOS)
afplay /tmp/test-speech.wav

# 3. Test LLM speed
time curl -X POST http://localhost:3000/api/llm \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:7b-instruct-q5_K_M",
    "messages": [{"role": "user", "content": "Say hello"}],
    "stream": false,
    "enableTools": false
  }'
```

## What changed:

### ✅ Piper TTS Fixes
1. **Timeout increased**: 30s → 60s (prevents premature timeouts)
2. **Speech speed**: 15% faster with `--length_scale 0.85`
3. **Reduced pauses**: `--sentence_silence 0.2` for snappier output
4. **Better cleanup**: Timeout properly cleared on success/error

### ✅ LLM Optimizations
1. **Context window reduced**: 16384 → 8192 tokens (50% faster processing)
2. **Applied to both streaming and non-streaming modes**

## Expected Results:

- **Piper TTS**: Should complete in 5-15 seconds (not timeout)
- **LLM Response**: Should start streaming within 2-3 seconds
- **Full Voice Cycle**: User speech → Response should be under 15-20 seconds total

## Next Steps (Optional but Recommended):

### Download a faster Piper voice model:

```bash
# Install medium-quality model (recommended - good balance)
cd ~/.piper/models
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
```

Then update `.env.local`:
```bash
NEXT_PUBLIC_PIPER_VOICE=en_US-lessac-medium
```

This will give you ~3x faster speech generation!

## Troubleshooting

### If still slow after these changes:

1. **Check Ollama model is loaded**:
   ```bash
   curl http://localhost:11434/api/ps
   ```

2. **Preload the model** (eliminates first-request delay):
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "qwen2.5-coder:7b-instruct-q5_K_M",
     "prompt": "test",
     "keep_alive": -1
   }'
   ```

3. **Check Ollama memory usage**:
   ```bash
   # Should show model is loaded in VRAM
   ps aux | grep ollama
   ```

4. **Monitor logs** during voice interaction:
   - Look for `[Piper]` timing logs
   - Look for `[VoiceOutput]` timing logs
   - Look for `[Memory]` ChromaDB queries (may add latency)

### Still having issues?

Check the full optimization guide: [VOICE_OPTIMIZATION.md](VOICE_OPTIMIZATION.md)
