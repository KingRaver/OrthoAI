'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioContextRecorder, AudioProcessor } from './audioRecorder';

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface TranscriptMetadata {
  confidence: number;
  language?: string;
  durationMs?: number;
  backend?: string;
}

interface UseVoiceInputOptions {
  onTranscript?: (text: string, metadata?: TranscriptMetadata) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: string) => void;
  silenceThresholdMs?: number;
  microphoneSensitivity?: number; // 0.5 - 2.0
}

interface VoiceInputState {
  state: VoiceState;
  transcript: string;
  transcriptionConfidence: number | null;
  audioLevel: number;
  error: string | null;
  isEnabled: boolean;
  isRecording: boolean;
}

interface DetectionState {
  noiseFloor: number;
  silenceThreshold: number;
  speechThreshold: number;
  hasSpeech: boolean;
  speechFrames: number;
  silenceMs: number;
  elapsedMs: number;
  interruptSpeechMs: number;
}

const DEBUG_VOICE = process.env.NEXT_PUBLIC_DEBUG_VOICE === 'true';
const MAX_RECORDING_MS = Number(process.env.NEXT_PUBLIC_VOICE_MAX_RECORDING_MS || 45000);

const voiceLog = (...args: unknown[]) => {
  if (DEBUG_VOICE) console.log(...args);
};

const voiceWarn = (...args: unknown[]) => {
  if (DEBUG_VOICE) console.warn(...args);
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function deriveThresholds(noiseFloor: number, sensitivity: number): {
  silenceThreshold: number;
  speechThreshold: number;
} {
  const normalizedSensitivity = clamp(sensitivity, 0.5, 2.0);
  const sensitivityScale = 1 / normalizedSensitivity;
  const silenceThreshold = clamp((noiseFloor * 1.8 + 0.002) * sensitivityScale, 0.002, 0.03);
  const speechThreshold = clamp(silenceThreshold * 2.4, silenceThreshold + 0.003, 0.08);
  return { silenceThreshold, speechThreshold };
}

function initialDetectionState(sensitivity: number): DetectionState {
  const baseNoiseFloor = 0.004;
  const { silenceThreshold, speechThreshold } = deriveThresholds(baseNoiseFloor, sensitivity);
  return {
    noiseFloor: baseNoiseFloor,
    silenceThreshold,
    speechThreshold,
    hasSpeech: false,
    speechFrames: 0,
    silenceMs: 0,
    elapsedMs: 0,
    interruptSpeechMs: 0
  };
}

type SttResponse = {
  success?: boolean;
  text?: string;
  language?: string;
  confidence?: number;
  duration?: number;
  backend?: string;
  error?: string;
};

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    onTranscript,
    onStateChange,
    onError,
    silenceThresholdMs = 3000,
    microphoneSensitivity = 1
  } = options;

  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    state: 'idle',
    transcript: '',
    transcriptionConfidence: null,
    audioLevel: 0,
    error: null,
    isEnabled: false,
    isRecording: false
  });

  const mountedRef = useRef(true);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<AudioContextRecorder | null>(null);
  const isEnabledRef = useRef(false);
  const isRecordingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const lastUiUpdateRef = useRef(0);
  const detectionStateRef = useRef<DetectionState>(initialDetectionState(microphoneSensitivity));
  const interruptCallbackRef = useRef<(() => void) | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);
  const silenceThresholdMsRef = useRef(silenceThresholdMs);
  const microphoneSensitivityRef = useRef(microphoneSensitivity);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onStateChangeRef.current = onStateChange;
    onErrorRef.current = onError;
  }, [onTranscript, onStateChange, onError]);

  useEffect(() => {
    silenceThresholdMsRef.current = silenceThresholdMs;
  }, [silenceThresholdMs]);

  useEffect(() => {
    microphoneSensitivityRef.current = microphoneSensitivity;
    const detection = detectionStateRef.current;
    const thresholds = deriveThresholds(detection.noiseFloor, microphoneSensitivityRef.current);
    detection.silenceThreshold = thresholds.silenceThreshold;
    detection.speechThreshold = thresholds.speechThreshold;
  }, [microphoneSensitivity]);

  const updateState = useCallback((state: VoiceState, error?: string) => {
    if (!mountedRef.current) return;

    setVoiceState((prev) => ({
      ...prev,
      state,
      error: error ?? null
    }));

    onStateChangeRef.current?.(state);
    if (error) {
      onErrorRef.current?.(error);
    }
  }, []);

  const transcribeWavBlob = useCallback(async (wavBlob: Blob) => {
    try {
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/wav'
        },
        body: wavBlob
      });

      const payload = (await response.json().catch(() => ({}))) as SttResponse;
      if (!response.ok) {
        throw new Error(payload.error || `STT failed with status ${response.status}`);
      }

      const text = (payload.text || '').trim();
      const confidence = clamp(
        typeof payload.confidence === 'number' ? payload.confidence : 0,
        0,
        1
      );

      if (!mountedRef.current) return;

      setVoiceState((prev) => ({
        ...prev,
        transcript: text,
        transcriptionConfidence: text.length > 0 ? confidence : null
      }));

      if (text.length > 0) {
        onTranscriptRef.current?.(text, {
          confidence,
          language: payload.language,
          durationMs: payload.duration,
          backend: payload.backend
        });
      }

      updateState('idle');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
      console.error('[VoiceInput] Transcription error:', errorMessage);
      updateState('error', errorMessage);
    }
  }, [updateState]);

  const finalizeRecordingRef = useRef<((shouldTranscribe: boolean) => Promise<void>) | null>(null);

  const finalizeRecording = useCallback(async (shouldTranscribe: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder || !isRecordingRef.current) return;

    stopRequestedRef.current = false;
    isRecordingRef.current = false;

    let wavBlob: Blob;
    try {
      wavBlob = recorder.stop();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      updateState('error', errorMessage);
      return;
    }

    if (!mountedRef.current) return;

    setVoiceState((prev) => ({
      ...prev,
      isRecording: false,
      audioLevel: 0
    }));

    if (!shouldTranscribe || wavBlob.size <= 44) {
      updateState('idle');
      return;
    }

    updateState('processing');
    await transcribeWavBlob(wavBlob);
  }, [transcribeWavBlob, updateState]);

  useEffect(() => {
    finalizeRecordingRef.current = finalizeRecording;
  }, [finalizeRecording]);

  const processAudioChunk = useCallback((chunk: Float32Array) => {
    if (!mountedRef.current) return;

    const recorder = recorderRef.current;
    if (!recorder) return;

    const sampleRate = Math.max(8000, recorder.getSampleRate());
    const chunkMs = (chunk.length / sampleRate) * 1000;
    const level = AudioProcessor.calculateRMS(chunk);
    const detection = detectionStateRef.current;

    const now = performance.now();
    if (now - lastUiUpdateRef.current >= 50) {
      lastUiUpdateRef.current = now;
      setVoiceState((prev) => ({ ...prev, audioLevel: level }));
    }

    if (isRecordingRef.current) {
      detection.elapsedMs += chunkMs;

      if (!detection.hasSpeech) {
        const calibrationLevel = Math.min(level, detection.speechThreshold);
        detection.noiseFloor = detection.noiseFloor * 0.95 + calibrationLevel * 0.05;
      } else {
        const ambientLevel = Math.min(level, detection.silenceThreshold);
        detection.noiseFloor = detection.noiseFloor * 0.98 + ambientLevel * 0.02;
      }

      const thresholds = deriveThresholds(
        detection.noiseFloor,
        microphoneSensitivityRef.current
      );
      detection.silenceThreshold = thresholds.silenceThreshold;
      detection.speechThreshold = thresholds.speechThreshold;

      if (!detection.hasSpeech) {
        if (level >= detection.speechThreshold) {
          detection.speechFrames += 1;
        } else {
          detection.speechFrames = Math.max(0, detection.speechFrames - 1);
        }

        if (detection.speechFrames >= 4) {
          detection.hasSpeech = true;
          detection.speechFrames = 0;
          detection.silenceMs = 0;
          voiceLog(
            `[VoiceInput] Speech detected (threshold=${detection.speechThreshold.toFixed(4)}, level=${level.toFixed(4)})`
          );
        }
      } else {
        if (level <= detection.silenceThreshold) {
          detection.silenceMs += chunkMs;
        } else {
          detection.silenceMs = 0;
        }

        if (
          detection.silenceMs >= silenceThresholdMsRef.current &&
          !stopRequestedRef.current
        ) {
          stopRequestedRef.current = true;
          void finalizeRecordingRef.current?.(true);
          return;
        }
      }

      if (detection.elapsedMs >= MAX_RECORDING_MS && !stopRequestedRef.current) {
        stopRequestedRef.current = true;
        voiceWarn('[VoiceInput] Max recording duration reached, finalizing');
        void finalizeRecordingRef.current?.(detection.hasSpeech);
        return;
      }

      return;
    }

    // Barge-in detection while AI is speaking.
    if (interruptCallbackRef.current && isEnabledRef.current) {
      const triggerThreshold = Math.max(0.01, detection.speechThreshold * 1.15);

      if (level >= triggerThreshold) {
        detection.interruptSpeechMs += chunkMs;
      } else {
        detection.interruptSpeechMs = Math.max(0, detection.interruptSpeechMs - chunkMs * 1.5);
      }

      if (detection.interruptSpeechMs >= 220) {
        detection.interruptSpeechMs = 0;
        const callback = interruptCallbackRef.current;
        interruptCallbackRef.current = null;
        callback?.();
      }
    }
  }, []);

  const initializeAudio = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 1
        }
      });

      mediaStreamRef.current = stream;

      const recorder = new AudioContextRecorder();
      await recorder.init(stream);
      recorder.setChunkListener((chunk) => processAudioChunk(chunk));
      recorderRef.current = recorder;

      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to access microphone';
      updateState('error', errorMessage);
      return false;
    }
  }, [processAudioChunk, updateState]);

  const startListening = useCallback(async () => {
    const initialized = await initializeAudio();
    if (!initialized) return;

    if (isRecordingRef.current) return;

    isEnabledRef.current = true;
    isRecordingRef.current = true;
    stopRequestedRef.current = false;
    interruptCallbackRef.current = null;
    detectionStateRef.current = initialDetectionState(microphoneSensitivityRef.current);

    recorderRef.current?.start();
    updateState('listening');

    setVoiceState((prev) => ({
      ...prev,
      isEnabled: true,
      isRecording: true,
      error: null
    }));
  }, [initializeAudio, updateState]);

  const stopListening = useCallback(() => {
    interruptCallbackRef.current = null;
    isEnabledRef.current = false;

    if (isRecordingRef.current) {
      void finalizeRecording(false);
    } else {
      updateState('idle');
    }

    setVoiceState((prev) => ({
      ...prev,
      isEnabled: false,
      isRecording: false,
      audioLevel: 0
    }));
  }, [finalizeRecording, updateState]);

  const resumeListening = useCallback(async () => {
    if (!isEnabledRef.current) return;
    await startListening();
  }, [startListening]);

  const startInterruptDetection = useCallback((onInterrupt: () => void) => {
    interruptCallbackRef.current = onInterrupt;
    detectionStateRef.current.interruptSpeechMs = 0;
  }, []);

  const stopInterruptDetection = useCallback(() => {
    interruptCallbackRef.current = null;
    detectionStateRef.current.interruptSpeechMs = 0;
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;

      interruptCallbackRef.current = null;
      isEnabledRef.current = false;
      isRecordingRef.current = false;

      try {
        recorderRef.current?.setChunkListener(null);
        recorderRef.current?.cleanup();
      } catch (error) {
        voiceWarn('[VoiceInput] Recorder cleanup error:', error);
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  return {
    state: voiceState.state,
    isEnabled: voiceState.isEnabled,
    isRecording: voiceState.isRecording,
    transcript: voiceState.transcript,
    transcriptionConfidence: voiceState.transcriptionConfidence,
    audioLevel: voiceState.audioLevel,
    error: voiceState.error,

    startListening,
    stopListening,
    resumeListening,
    startInterruptDetection,
    stopInterruptDetection,
    clearTranscript: () =>
      setVoiceState((prev) => ({
        ...prev,
        transcript: '',
        transcriptionConfidence: null
      }))
  };
}
