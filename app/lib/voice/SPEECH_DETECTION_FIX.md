# Speech Detection Fix

## Problem
After the latency optimization (commit 047d65b), the speech recognition system was cutting off user speech prematurely. The system was stopping recording too early because the silence detection was too aggressive.

## Root Cause
The latency optimization made several changes to speed up responses:
1. Reduced LLM context window (16384 → 8192 tokens)
2. Added faster Piper TTS speech generation
3. **Side effect**: The existing silence detection threshold (0.01 or 1%) was too sensitive

The silence sensitivity of 1% caused the system to:
- Stop recording during natural speech pauses
- Cut off quieter speech
- Trigger on background noise fluctuations

## Solution Applied

### 1. **Improved Silence Detection** ([useVoiceInput.ts:143-148](useVoiceInput.ts#L143-L148))

**Lower Silence Threshold:**
```typescript
const SILENCE_SENSITIVITY = 0.005; // Was 0.01 - now 0.5% instead of 1%
```
- Less aggressive silence detection
- Allows for natural speech pauses
- Better handles quieter speech

**Two-Stage Detection:**
```typescript
const SPEECH_START_THRESHOLD = 0.015; // 1.5% to confirm speech started
let initialSoundDetected = false; // Track if we've heard speech
```

Now the system:
1. **Waits for speech to start** (level > 1.5%) before monitoring silence
2. **Only counts silence** after detecting initial speech
3. **Prevents premature stoppage** during the delay before user speaks

### 2. **Faster Audio Analysis** ([useVoiceInput.ts:99](useVoiceInput.ts#L99))

```typescript
analyser.smoothingTimeConstant = 0.7; // Was 0.8 - faster response
```
- Reduced from 0.8 to 0.7 for quicker response to audio level changes
- Better tracks rapid speech variations
- Maintains smooth visualization

## How It Works Now

### Recording Flow:
1. **User clicks microphone** → Recording starts
2. **System waits** for audio level > 1.5% (speech start threshold)
3. **Once speech detected** → Begin monitoring for silence
4. **During speech** → Any sound > 0.5% resets silence counter
5. **After speech ends** → 3 seconds of silence (< 0.5%) stops recording
6. **Audio sent to Whisper** → Transcription → Response

### Key Improvements:
✅ Won't stop during speech pauses
✅ Captures full sentences and thoughts
✅ Better handles varying microphone levels
✅ Still maintains fast response (3s silence threshold)
✅ Prevents false starts (waits for real speech)

## Testing

To verify the fix is working:

1. **Start voice mode** in the app
2. **Speak naturally** with pauses between words
3. **Watch console logs** for:
   - `[VoiceInput] Speech start detected` when you begin speaking
   - `[VoiceInput] Sound detected` when resuming after pauses
   - `[VoiceInput] Silence detected` only after truly finishing

4. **Test different scenarios:**
   - Speaking with natural pauses
   - Speaking at different volumes
   - Background noise with speech
   - Short phrases vs long sentences

## Configuration

You can adjust the thresholds in [useVoiceInput.ts](useVoiceInput.ts#L143-L146):

```typescript
const SILENCE_SENSITIVITY = 0.005;      // Lower = less sensitive to silence
const SPEECH_START_THRESHOLD = 0.015;   // Higher = requires clearer speech start
const silenceThresholdMs = 3000;        // Milliseconds of silence before stopping
```

### Recommended Values:
- **Noisy environment**: Increase `SPEECH_START_THRESHOLD` to 0.02-0.025
- **Very quiet microphone**: Lower `SPEECH_START_THRESHOLD` to 0.01
- **Faster responses**: Reduce `silenceThresholdMs` to 2000-2500ms
- **Longer conversations**: Increase `silenceThresholdMs` to 4000-5000ms

## Performance Impact

✅ **No latency added** - Changes only affect detection logic
✅ **Same response speed** - Still stops after 3s of true silence
✅ **Better accuracy** - Captures complete user input
✅ **Maintains optimizations** - All previous speed improvements intact

## Related Files Changed

- [app/lib/voice/useVoiceInput.ts](useVoiceInput.ts) - Main speech detection logic
  - Line 143-148: Adjusted thresholds and added two-stage detection
  - Line 173-200: Added initial speech detection before silence monitoring
  - Line 99: Reduced analyser smoothing for faster response
