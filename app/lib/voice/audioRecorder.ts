// app/lib/voice/audioRecorder.ts
/**
 * Audio Recorder Utility
 *
 * Provides:
 * 1. WAV file encoding for high-quality audio (PCM 16-bit)
 * 2. Raw audio recording from AudioContext
 * 3. Audio processing helpers (resampling, normalization)
 * 4. Format conversion utilities
 *
 * WAV format provides:
 * - Better compatibility with Whisper
 * - Direct PCM encoding (no compression artifacts)
 * - Smaller file size than WebM for short recordings
 * - Industry standard for speech recognition
 */

/**
 * WAV File Header Writer
 * Creates proper WAV file format with headers
 */
class WAVEncoder {
  private sampleRate: number;
  private channelCount: number;

  constructor(sampleRate: number = 16000, channelCount: number = 1) {
    this.sampleRate = sampleRate;
    this.channelCount = channelCount;
  }

  /**
   * Encode raw PCM float samples to WAV format
   * @param audioData - Float32Array of audio samples [-1.0, 1.0]
   * @returns Blob containing WAV file data
   */
  encode(audioData: Float32Array): Blob {
    // Calculate sizes
    const bytesPerSample = 2; // 16-bit = 2 bytes
    const blockAlign = this.channelCount * bytesPerSample;
    const dataLength = audioData.length * bytesPerSample;
    const bufferLength = 44 + dataLength; // 44 byte header + data

    // Create buffer for WAV file
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // Helper function to write strings to DataView
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV file header (44 bytes total)
    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true); // File size - 8
    writeString(8, 'WAVE');

    // fmt subchunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, this.channelCount, true); // NumChannels
    view.setUint32(24, this.sampleRate, true); // SampleRate
    view.setUint32(28, this.sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data subchunk
    writeString(36, 'data');
    view.setUint32(40, dataLength, true); // Subchunk2Size

    // Write audio data (convert from float to 16-bit PCM)
    this.writeAudioData(view, audioData, 44);

    // Create and return Blob
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Convert float audio samples to 16-bit PCM and write to DataView
   */
  private writeAudioData(
    view: DataView,
    audioData: Float32Array,
    offset: number
  ) {
    let index = offset;
    const volume = 0.8; // Prevent clipping on loud audio

    for (let i = 0; i < audioData.length; i++) {
      // Clamp and scale float to 16-bit integer range
      let sample = audioData[i] * volume;
      sample = Math.max(-1, Math.min(1, sample)); // Clamp to [-1, 1]
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // Scale to 16-bit

      // Write as little-endian 16-bit integer
      view.setInt16(index, sample, true);
      index += 2;
    }
  }
}

/**
 * Audio Recorder using AudioContext for raw PCM recording
 * Useful for high-quality, low-latency recording
 */
class AudioContextRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioData: Float32Array[] = [];
  private sampleRate: number = 0;
  private isRecording: boolean = false;

  /**
   * Initialize recorder with a media stream
   */
  async init(stream: MediaStream): Promise<void> {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;

    const mediaStreamSource = audioContext.createMediaStreamSource(stream);
    this.mediaStreamSource = mediaStreamSource;

    // Create ScriptProcessor for raw audio access
    // BufferSize: 4096 samples (good balance of latency vs. CPU)
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    this.processor = processor;

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (this.isRecording) {
        const audioData = event.inputBuffer.getChannelData(0);
        // Store a copy of the audio data
        this.audioData.push(new Float32Array(audioData));
      }
    };

    mediaStreamSource.connect(processor);
    processor.connect(audioContext.destination);
  }

  /**
   * Start recording
   */
  start(): void {
    this.audioData = [];
    this.isRecording = true;
  }

  /**
   * Stop recording and return WAV blob
   */
  stop(): Blob {
    this.isRecording = false;

    // Concatenate all audio chunks into single array
    const totalLength = this.audioData.reduce((sum, arr) => sum + arr.length, 0);
    const concatenated = new Float32Array(totalLength);
    let offset = 0;

    for (const chunk of this.audioData) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    // Encode to WAV
    const encoder = new WAVEncoder(this.sampleRate, 1);
    return encoder.encode(concatenated);
  }

  /**
   * Get sample rate for proper audio processing
   */
  getSampleRate(): number {
    return this.sampleRate;
  }

  /**
   * Cleanup audio context
   */
  cleanup(): void {
    if (this.processor) {
      this.processor.disconnect();
    }
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

/**
 * Audio Processing Utilities
 */
class AudioProcessor {
  /**
   * Resample audio to target sample rate
   * Useful for converting 48kHz → 16kHz for Whisper
   */
  static resample(
    audioData: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return audioData;

    const ratio = toRate / fromRate;
    const newLength = Math.round(audioData.length * ratio);
    const resampled = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const originalIndex = i / ratio;
      const floorIndex = Math.floor(originalIndex);
      const ceilIndex = Math.ceil(originalIndex);
      const fraction = originalIndex - floorIndex;

      // Linear interpolation
      const sample1 = audioData[floorIndex] || 0;
      const sample2 = audioData[ceilIndex] || 0;
      resampled[i] = sample1 * (1 - fraction) + sample2 * fraction;
    }

    return resampled;
  }

  /**
   * Normalize audio to prevent clipping
   * Scales audio to use full dynamic range
   */
  static normalize(audioData: Float32Array): Float32Array {
    let max = 0;
    for (let i = 0; i < audioData.length; i++) {
      max = Math.max(max, Math.abs(audioData[i]));
    }

    if (max === 0) return audioData;

    const normalized = new Float32Array(audioData.length);
    const scale = 0.95 / max; // 95% to leave headroom

    for (let i = 0; i < audioData.length; i++) {
      normalized[i] = audioData[i] * scale;
    }

    return normalized;
  }

  /**
   * Apply noise gate to remove background noise
   * Removes samples below threshold
   */
  static noiseGate(
    audioData: Float32Array,
    threshold: number = 0.02
  ): Float32Array {
    const gated = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      gated[i] = Math.abs(audioData[i]) > threshold ? audioData[i] : 0;
    }
    return gated;
  }

  /**
   * Calculate RMS (Root Mean Square) - audio level indicator
   */
  static calculateRMS(audioData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Trim silence from beginning and end of audio
   */
  static trimSilence(
    audioData: Float32Array,
    threshold: number = 0.01
  ): Float32Array {
    let start = 0;
    let end = audioData.length - 1;

    // Find first non-silent sample
    while (start < audioData.length && Math.abs(audioData[start]) < threshold) {
      start++;
    }

    // Find last non-silent sample
    while (end >= 0 && Math.abs(audioData[end]) < threshold) {
      end--;
    }

    // Return trimmed audio
    if (start > end) return new Float32Array(0);
    return audioData.slice(start, end + 1);
  }
}

/**
 * Helper function to convert WebM/Opus blob to WAV
 * Useful if you're using MediaRecorder with webm format
 */
async function webmToWav(webmBlob: Blob): Promise<Blob> {
  try {
    console.log(`[AudioRecorder] Converting WebM blob (${webmBlob.size} bytes, type: ${webmBlob.type})`);

    const arrayBuffer = await webmBlob.arrayBuffer();
    console.log(`[AudioRecorder] ArrayBuffer size: ${arrayBuffer.byteLength} bytes`);

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    console.log(`[AudioRecorder] AudioContext sample rate: ${audioContext.sampleRate}Hz`);

    // Decode webm to raw PCM
    const decodedAudio = await audioContext.decodeAudioData(arrayBuffer);
    console.log(`[AudioRecorder] Decoded audio: ${decodedAudio.duration.toFixed(2)}s, ${decodedAudio.numberOfChannels} channels, ${decodedAudio.sampleRate}Hz`);

    const channelData = decodedAudio.getChannelData(0);
    console.log(`[AudioRecorder] Channel 0 data: ${channelData.length} samples`);

    // Calculate audio levels to verify we have actual audio
    let sum = 0;
    let max = 0;
    for (let i = 0; i < channelData.length; i++) {
      const abs = Math.abs(channelData[i]);
      sum += abs;
      max = Math.max(max, abs);
    }
    const avgLevel = sum / channelData.length;
    console.log(`[AudioRecorder] Audio levels - avg: ${avgLevel.toFixed(6)}, max: ${max.toFixed(6)}`);

    // Normalize audio if it's too quiet (boost by up to 10x)
    let processedData = channelData;
    if (max > 0 && max < 0.1) {
      const targetLevel = 0.5; // Target 50% of max volume
      const gain = Math.min(10, targetLevel / max); // Cap at 10x gain
      console.log(`[AudioRecorder] Audio too quiet (max: ${max.toFixed(4)}), applying ${gain.toFixed(2)}x gain`);

      processedData = new Float32Array(channelData.length);
      for (let i = 0; i < channelData.length; i++) {
        processedData[i] = Math.max(-1, Math.min(1, channelData[i] * gain));
      }

      // Recalculate levels after normalization
      let newMax = 0;
      for (let i = 0; i < processedData.length; i++) {
        newMax = Math.max(newMax, Math.abs(processedData[i]));
      }
      console.log(`[AudioRecorder] After normalization - max: ${newMax.toFixed(6)}`);
    }

    // Encode to WAV
    const encoder = new WAVEncoder(decodedAudio.sampleRate, 1);
    const wavBlob = encoder.encode(processedData);
    console.log(`[AudioRecorder] Encoded WAV: ${wavBlob.size} bytes`);

    return wavBlob;
  } catch (error) {
    console.error('[AudioRecorder] WebM to WAV conversion failed:', error);
    throw error;
  }
}

export {
  WAVEncoder,
  AudioContextRecorder,
  AudioProcessor,
  webmToWav
};