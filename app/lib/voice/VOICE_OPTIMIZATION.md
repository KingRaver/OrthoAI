# Voice System Optimization Guide

## Current Issues Fixed

### 1. Piper TTS Timeout ✅
- **Problem**: 30-second timeout was too aggressive for 130MB model loading
- **Solution**: Increased timeout to 60 seconds with better error messages
- **Location**: [app/api/piper-tts/route.ts](../../api/piper-tts/route.ts)

### 2. Speech Generation Speed ✅
- **Problem**: Default Piper settings were slow
- **Solution**: Added performance optimizations:
  - `--length_scale 0.85`: Speeds up speech by 15%
  - `--sentence_silence 0.2`: Reduces pauses between sentences
- **Location**: [app/api/piper-tts/route.ts](../../api/piper-tts/route.ts)

## Recommended: Install Faster Voice Models

Your current model `en_US-libritts-high` is 130MB and high quality but slower.

### Download Faster Models

```bash
# Medium quality - much faster (recommended)
cd ~/.piper/models
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

# Or lightweight option - fastest
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/low/en_US-amy-low.onnx
wget https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/amy/low/en_US-amy-low.onnx.json
```

### Update .env.local

```bash
# Change from:
NEXT_PUBLIC_PIPER_VOICE=en_US-libritts-high

# To faster option:
NEXT_PUBLIC_PIPER_VOICE=en_US-lessac-medium
# or
NEXT_PUBLIC_PIPER_VOICE=en_US-amy-low
```

## Overall Response Time Optimization

The "minutes for a response" issue is likely due to multiple factors:

### 1. LLM Response Time
**Check Ollama performance:**
```bash
# Test LLM speed directly
time curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:7b-instruct-q5_K_M",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

**Optimization tips:**
- Reduce `num_ctx` from 16384 to 8192 or 4096 in [app/api/llm/route.ts](../../api/llm/route.ts#L119)
- Use smaller model like `llama3.2:3b-instruct-q5_K_M`
- Ensure Ollama is using GPU acceleration

### 2. Memory/ChromaDB Latency
The system queries ChromaDB on every request for memory augmentation.

**Quick fix - Disable for voice mode:**
Edit [app/api/llm/route.ts](../../api/llm/route.ts):
```typescript
// Around line 22, add check for voice mode
useMemory = useMemory && !isVoiceRequest, // Disable memory for fast voice responses
```

### 3. Sequential Processing
Currently: User speaks → Whisper STT → LLM → Piper TTS

**Can't be parallelized but can be optimized:**
- Use faster models at each stage
- Reduce context windows
- Disable memory augmentation for voice

## Performance Checklist

- [x] Increase Piper timeout to 60s
- [x] Add speech speed optimization (--length_scale 0.85)
- [ ] Install faster Piper voice model (lessac-medium or amy-low)
- [ ] Update NEXT_PUBLIC_PIPER_VOICE in .env.local
- [ ] Test LLM response time
- [ ] Consider reducing num_ctx from 16384 to 4096
- [ ] Consider disabling memory augmentation for voice requests

## Testing After Changes

```bash
# 1. Restart Next.js dev server
npm run dev

# 2. Test voice flow end-to-end
# - Enable voice mode in UI
# - Say something short like "Hello"
# - Time the full response cycle

# 3. Check console logs for timing:
# - [VoiceOutput] TTS API response time
# - [Piper] Process completion time
# - [Memory] Retrieved context time (if applicable)
```

## Expected Performance After Optimization

| Stage | Before | After |
|-------|--------|-------|
| Piper TTS | Timeout at 30s | Timeout at 60s, 15% faster speech |
| Speech Speed | Normal | 15% faster with reduced pauses |
| Model Loading | 130MB (slow) | ~50MB with medium/low models |

**Target**: End-to-end voice response under 10 seconds for short queries (was timing out before).
