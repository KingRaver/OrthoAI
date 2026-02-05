// app/lib/voice/useVoiceOutput.ts
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { AudioAnalyzer, extractBeatFromFrequency } from './audioAnalyzer';

interface FrequencyData {
  frequency: number;
  amplitude: number;
  beat: number;
}

interface UseVoiceOutputOptions {
  onFrequencyAnalysis?: (data: FrequencyData) => void;
  onPlaybackEnd?: () => void;
  onError?: (error: string) => void;
  voice?: string; // Piper voice ID (e.g., 'en_US-libritts-high')
}

interface VoiceOutputState {
  isPlaying: boolean;
  isGenerating: boolean;
  error: string | null;
  progress: number; // 0-1
}

export function useVoiceOutput(options: UseVoiceOutputOptions = {}) {
  const {
    onFrequencyAnalysis,
    onPlaybackEnd,
    onError,
    voice = 'en_US-libritts-high'
  } = options;

  const [state, setState] = useState<VoiceOutputState>({
    isPlaying: false,
    isGenerating: false,
    error: null,
    progress: 0
  });

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const previousAmplitudeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in refs to avoid re-initialization
  const onFrequencyAnalysisRef = useRef(onFrequencyAnalysis);
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  const onErrorRef = useRef(onError);

  // Update refs when callbacks change
  useEffect(() => {
    onFrequencyAnalysisRef.current = onFrequencyAnalysis;
    onPlaybackEndRef.current = onPlaybackEnd;
    onErrorRef.current = onError;
  }, [onFrequencyAnalysis, onPlaybackEnd, onError]);

  // Initialize audio context and analyzer (once)
  useEffect(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      console.log('[VoiceOutput] AudioContext initialized - state:', audioContext.state);

      // Create hidden audio element for playback
      const audioElement = new Audio();
      audioElement.crossOrigin = 'anonymous';
      audioElementRef.current = audioElement;

      // Create media source from audio element
      const sourceNode = audioContext.createMediaElementSource(audioElement);
      sourceNodeRef.current = sourceNode;

      // Initialize frequency analyzer with the same audio context
      const analyzer = new AudioAnalyzer((frequencyData) => {
        const beat = extractBeatFromFrequency(
          frequencyData.frequency,
          frequencyData.amplitude,
          previousAmplitudeRef.current
        );

        previousAmplitudeRef.current = frequencyData.amplitude;

        onFrequencyAnalysisRef.current?.({
          frequency: frequencyData.frequency,
          amplitude: frequencyData.amplitude,
          beat
        });
      }, audioContext);

      // Connect the audio graph: source -> analyzer -> destination
      sourceNode.connect(analyzer.getAnalyser());
      analyzer.getAnalyser().connect(audioContext.destination);
      analyzerRef.current = analyzer;

      // Setup playback event listeners
      audioElement.onplay = () => {
        setState(prev => ({ ...prev, isPlaying: true }));
        analyzer.start();
      };

      audioElement.onended = () => {
        setState(prev => ({ ...prev, isPlaying: false, progress: 1 }));
        analyzer.stop();
        onPlaybackEndRef.current?.();
      };

      audioElement.onerror = () => {
        const errorMsg = `Audio playback error: ${audioElement.error?.message || 'Unknown'}`;
        setState(prev => ({ ...prev, error: errorMsg, isPlaying: false }));
        analyzer.stop();
        onErrorRef.current?.(errorMsg);
      };

      audioElement.ontimeupdate = () => {
        if (audioElement.duration > 0) {
          setState(prev => ({
            ...prev,
            progress: audioElement.currentTime / audioElement.duration
          }));
        }
      };

      return () => {
        analyzer.dispose();
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Audio context failed';
      setState(prev => ({ ...prev, error: errorMsg }));
      onErrorRef.current?.(errorMsg);
    }
  }, []);

  /**
   * Generate speech from text using Piper TTS API and play it
   */
  const speak = useCallback(
    async (text: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!text.trim()) {
          console.log('[VoiceOutput] Empty text, skipping speech');
          resolve();
          return;
        }

        console.log(`[VoiceOutput] Starting TTS for text (${text.length} chars): "${text.substring(0, 50)}..."`);

        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        (async () => {
          try {
            setState(prev => ({
              ...prev,
              isGenerating: true,
              error: null,
              progress: 0
            }));

            console.log('[VoiceOutput] Calling Piper TTS API...');

            // Call Piper TTS API endpoint
            const response = await fetch('/api/piper-tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text, voice }),
              signal: abortControllerRef.current?.signal
            });

            console.log(`[VoiceOutput] TTS API response: ${response.status} ${response.statusText}`);

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Get audio blob
            const audioBlob = await response.blob();
            console.log(`[VoiceOutput] Received audio blob: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

            if (audioBlob.size === 0) {
              throw new Error('Empty audio response from Piper TTS');
            }

            // Create blob URL and play
            const audioUrl = URL.createObjectURL(audioBlob);
            console.log('[VoiceOutput] Created audio URL, preparing to play...');

            if (!audioElementRef.current) {
              throw new Error('Audio element not initialized');
            }

            const audioElement = audioElementRef.current;
            audioElement.src = audioUrl;

            // Resume AudioContext if it was suspended (browser autoplay restriction)
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              console.log('[VoiceOutput] AudioContext suspended - resuming...');
              await audioContextRef.current.resume();
              console.log('[VoiceOutput] AudioContext state:', audioContextRef.current.state);
            }

            console.log('[VoiceOutput] Starting audio playback...');

            // Play audio
            const playPromise = audioElement.play();

            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('[VoiceOutput] Audio playback started successfully');
                  setState(prev => ({
                    ...prev,
                    isGenerating: false
                  }));
                })
                .catch(err => {
                  console.error('[VoiceOutput] Play promise rejected:', err);
                  // Ignore abort errors (user cancelled)
                  if (err.name !== 'AbortError') {
                    throw err;
                  }
                });
            } else {
              console.warn('[VoiceOutput] play() did not return a promise');
            }

            // Wait for audio to finish
            await new Promise<void>((audioResolve, audioReject) => {
              const onEnded = () => {
                audioElement.removeEventListener('ended', onEnded);
                audioElement.removeEventListener('error', onError);
                URL.revokeObjectURL(audioUrl);
                audioResolve();
              };

              const onError = () => {
                audioElement.removeEventListener('ended', onEnded);
                audioElement.removeEventListener('error', onError);
                URL.revokeObjectURL(audioUrl);
                audioReject(new Error(`Audio playback failed: ${audioElement.error?.message}`));
              };

              audioElement.addEventListener('ended', onEnded);
              audioElement.addEventListener('error', onError);
            });

            resolve();
          } catch (error: unknown) {
            // Don't treat abort errors as failures
            if (error instanceof Error && error.name === 'AbortError') {
              resolve();
              return;
            }

            const errorMessage = error instanceof Error ? error.message : 'Voice output error';
            setState(prev => ({
              ...prev,
              isGenerating: false,
              error: errorMessage,
              isPlaying: false
            }));
            onErrorRef.current?.(errorMessage);
            reject(error);
          }
        })();
      });
    },
    [voice]
  );

  /**
   * Stop playback
   */
  const stop = useCallback(() => {
    // Abort any pending TTS request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      URL.revokeObjectURL(audioElementRef.current.src);
    }
    if (analyzerRef.current) {
      analyzerRef.current.stop();
    }
    setState(prev => ({
      ...prev,
      isPlaying: false,
      isGenerating: false,
      progress: 0
    }));
  }, []);

  /**
   * Get current audio level (0-1) for visual feedback
   */
  const getAudioLevel = useCallback(() => {
    if (analyzerRef.current && state.isPlaying) {
      return analyzerRef.current.getAverageAmplitude();
    }
    return 0;
  }, [state.isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        URL.revokeObjectURL(audioElementRef.current.src);
      }
      if (analyzerRef.current) {
        analyzerRef.current.dispose();
      }
    };
  }, []);

  return {
    ...state,
    speak,
    stop,
    getAudioLevel,
    isPlaying: state.isPlaying
  };
}