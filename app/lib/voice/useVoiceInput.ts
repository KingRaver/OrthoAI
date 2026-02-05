// app/lib/voice/useVoiceInput.ts
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { webmToWav } from './audioRecorder';

type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface UseVoiceInputOptions {
  onTranscript?: (text: string) => void;
  onStateChange?: (state: VoiceState) => void;
  onError?: (error: string) => void;
  silenceThresholdMs?: number; // milliseconds of silence to detect end of speech (default: 3000)
}

interface VoiceInputState {
  state: VoiceState;
  transcript: string;
  audioLevel: number; // 0-1 for UI visualization
  error: string | null;
  isEnabled: boolean;
}

export function useVoiceInput(options: UseVoiceInputOptions = {}) {
  const {
    onTranscript,
    onStateChange,
    onError,
    silenceThresholdMs = 3000 // 3 seconds default silence detection
  } = options;

  const [voiceState, setVoiceState] = useState<VoiceInputState>({
    state: 'idle',
    transcript: '',
    audioLevel: 0,
    error: null,
    isEnabled: false
  });

  // Refs for audio recording and silence detection
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAudioLevelRef = useRef<number>(0);
  const silenceCountRef = useRef<number>(0);

  // Store callbacks in refs to avoid re-initialization
  const onTranscriptRef = useRef(onTranscript);
  const onStateChangeRef = useRef(onStateChange);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
    onStateChangeRef.current = onStateChange;
    onErrorRef.current = onError;
  }, [onTranscript, onStateChange, onError]);

  // Update state and notify
  const updateState = useCallback((newState: VoiceState, error?: string) => {
    setVoiceState(prev => ({
      ...prev,
      state: newState,
      error: error || null
    }));
    onStateChangeRef.current?.(newState);
    if (error) {
      onErrorRef.current?.(error);
    }
  }, []);

  // Initialize audio recording
  const initializeAudio = useCallback(async () => {
    try {
      // Request microphone access with enhanced audio settings
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // Enable AGC to boost quiet microphones
          sampleRate: 48000, // Higher sample rate for better quality
          channelCount: 1 // Mono
        }
      });

      mediaStreamRef.current = stream;

      // Create audio context for real-time level monitoring
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7; // Reduced from 0.8 for faster response to speech changes

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      // Create MediaRecorder for audio chunks
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Audio recording stopped, send to whisper
        if (audioChunksRef.current.length === 0) {
          updateState('idle');
          return;
        }

        updateState('processing');
        await transcribeAudio();
      };

      mediaRecorderRef.current = mediaRecorder;

      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to access microphone';
      updateState('error', errorMsg);
      return false;
    }
  }, [updateState]);

  // Monitor audio levels and detect silence
  const startAudioLevelMonitoring = useCallback(() => {
    if (!analyserRef.current || !mediaRecorderRef.current) {
      return;
    }

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    let consecutiveSilenceFrames = 0;
    let initialSoundDetected = false; // Track if we've heard any sound yet
    const SILENCE_SENSITIVITY = 0.005; // Audio level threshold for silence (0.5% - less aggressive)
    const SPEECH_START_THRESHOLD = 0.015; // Require 1.5% level to confirm speech started
    const FRAMES_FOR_SILENCE = Math.ceil(silenceThresholdMs / 50); // ~50ms per frame

    console.log(`[VoiceInput] Starting audio monitoring - silence threshold: ${SILENCE_SENSITIVITY}, speech start: ${SPEECH_START_THRESHOLD}, frames needed: ${FRAMES_FOR_SILENCE}`);

    const monitorLevel = () => {
      // Check if recording is still active (don't rely on stale state)
      if (!analyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average frequency level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const level = sum / dataArray.length / 255;
      lastAudioLevelRef.current = level;

      // Update UI level
      setVoiceState(prev => ({
        ...prev,
        audioLevel: level
      }));

      // Detect if user has started speaking (need higher threshold to confirm speech)
      if (!initialSoundDetected && level > SPEECH_START_THRESHOLD) {
        initialSoundDetected = true;
        console.log(`[VoiceInput] Speech start detected (level: ${level.toFixed(4)})`);
      }

      // Only start counting silence AFTER we've detected initial speech
      // This prevents stopping recording during the delay before user starts speaking
      if (initialSoundDetected) {
        // Detect silence: if level is below threshold, increment counter
        if (level < SILENCE_SENSITIVITY) {
          consecutiveSilenceFrames++;
          if (consecutiveSilenceFrames % 20 === 0) {
            console.log(`[VoiceInput] Silence frames: ${consecutiveSilenceFrames}/${FRAMES_FOR_SILENCE}, level: ${level.toFixed(4)}`);
          }
        } else {
          // Reset silence counter when sound is detected
          if (consecutiveSilenceFrames > 0) {
            console.log(`[VoiceInput] Sound detected (level: ${level.toFixed(4)}) - resetting silence counter`);
          }
          consecutiveSilenceFrames = 0;
        }

        // If we've detected silence for the threshold duration, stop recording
        if (consecutiveSilenceFrames >= FRAMES_FOR_SILENCE && mediaRecorderRef.current?.state === 'recording') {
          console.log(`[VoiceInput] Silence detected (${consecutiveSilenceFrames} frames) - stopping recording`);
          mediaRecorderRef.current.stop();
          return; // Stop monitoring
        }
      }

      requestAnimationFrame(monitorLevel);
    };

    monitorLevel();
  }, [silenceThresholdMs]);

  // Transcribe audio using Whisper API
  const transcribeAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) {
      updateState('idle');
      return;
    }

    try {
      // Create blob from audio chunks
      const webmBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = []; // Clear chunks for next recording

      console.log(`[VoiceInput] Converting WebM (${webmBlob.size} bytes) to WAV...`);

      // Convert WebM to WAV for Whisper
      const wavBlob = await webmToWav(webmBlob);

      console.log(`[VoiceInput] Converted to WAV (${wavBlob.size} bytes)`);

      // Create FormData with WAV audio
      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio.wav');

      console.log(`[VoiceInput] Sending ${wavBlob.size} bytes to Whisper...`);

      // Send to Whisper STT endpoint
      const response = await fetch('/api/stt', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error || `STT failed with status ${response.status}`
        );
      }

      const result = await response.json();

      if (!result.success || !result.text) {
        console.log('[VoiceInput] No speech detected');
        updateState('listening');
        return;
      }

      console.log(`[VoiceInput] Transcribed: "${result.text}"`);

      // Update transcript state
      setVoiceState(prev => ({
        ...prev,
        transcript: result.text
      }));

      // Fire callback with transcript
      if (onTranscriptRef.current) {
        onTranscriptRef.current(result.text);
      }

      // Return to listening state for seamless conversation loop
      updateState('listening');

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Transcription failed';
      console.error('[VoiceInput] Transcription error:', errorMsg);
      updateState('error', errorMsg);
    }
  }, [updateState]);

  // Start listening (called when voice toggle is turned ON)
  const startListening = useCallback(async () => {
    try {
      setVoiceState(prev => ({
        ...prev,
        isEnabled: true,
        error: null,
        transcript: ''
      }));

      // Initialize audio if not already done
      if (!mediaRecorderRef.current) {
        const initialized = await initializeAudio();
        if (!initialized) {
          return;
        }
      }

      // Start recording
      if (mediaRecorderRef.current?.state !== 'recording') {
        audioChunksRef.current = [];
        mediaRecorderRef.current?.start();
      }

      updateState('listening');
      startAudioLevelMonitoring();

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to start listening';
      updateState('error', errorMsg);
    }
  }, [initializeAudio, updateState, startAudioLevelMonitoring]);

  // Stop listening (called when voice toggle is turned OFF or AI starts speaking)
  const stopListening = useCallback(() => {
    try {
      // Stop recording
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Clear any pending silence timeouts
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }

      setVoiceState(prev => ({
        ...prev,
        isEnabled: false,
        audioLevel: 0
      }));

      updateState('idle');

    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to stop listening';
      console.warn('[VoiceInput] Stop error:', errorMsg);
    }
  }, [updateState]);

  // Resume listening after AI response (for seamless conversation loop)
  const resumeListening = useCallback(async () => {
    if (voiceState.isEnabled) {
      // Small delay to ensure TTS is fully finished
      await new Promise(resolve => setTimeout(resolve, 500));
      await startListening();
    }
  }, [voiceState.isEnabled, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up without triggering state updates
      try {
        // Stop recording
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }

        // Clear any pending silence timeouts
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
        }
      } catch (error) {
        console.warn('[VoiceInput] Cleanup error:', error);
      }

      // Clean up media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Close audio context
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on unmount to avoid infinite loops

  return {
    // State
    state: voiceState.state,
    isEnabled: voiceState.isEnabled,
    transcript: voiceState.transcript,
    audioLevel: voiceState.audioLevel,
    error: voiceState.error,

    // Controls
    startListening,
    stopListening,
    resumeListening,
    clearTranscript: () => setVoiceState(prev => ({ ...prev, transcript: '' }))
  };
}