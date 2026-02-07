/**
 * useVoiceFlow Hook
 * Unified voice interaction combining STT + TTS + interruption handling
 * Flow: listen -> transcribe -> think -> speak -> auto-listen
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceInput } from './useVoiceInput';
import { useVoiceOutput } from './useVoiceOutput';

type ConversationState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking'
  | 'speaking'
  | 'auto-resuming'
  | 'error';

const DEBUG_VOICE = process.env.NEXT_PUBLIC_DEBUG_VOICE === 'true';
const voiceLog = (...args: unknown[]) => {
  if (DEBUG_VOICE) console.log(...args);
};

interface UseVoiceFlowProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: ConversationState) => void;
  microphoneSensitivity?: number;
}

export function useVoiceFlow({
  onTranscript,
  onError,
  onStateChange,
  microphoneSensitivity = 1
}: UseVoiceFlowProps) {
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [audioFrequency, setAudioFrequency] = useState({ beat: 0, amplitude: 0 });
  const [userTranscript, setUserTranscript] = useState('');
  const [transcriptionConfidence, setTranscriptionConfidence] = useState<number | null>(null);
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const conversationStateRef = useRef<ConversationState>('idle');
  const autoResumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoResumingRef = useRef(false);
  const lastFrequencyUpdateRef = useRef(0);

  const updateState = useCallback((newState: ConversationState) => {
    conversationStateRef.current = newState;
    setConversationState(newState);
    onStateChange?.(newState);
    voiceLog(`[VoiceFlow] State: ${newState}`);
  }, [onStateChange]);

  const voiceInput = useVoiceInput({
    onTranscript: (text, metadata) => {
      voiceLog(`[VoiceFlow] Transcript received: "${text}"`);
      setUserTranscript(text);
      setTranscriptionConfidence(metadata?.confidence ?? null);
      updateState('processing');
      onTranscript(text);
    },
    onStateChange: (inputState) => {
      switch (inputState) {
        case 'listening':
          updateState('listening');
          break;
        case 'processing':
          updateState('processing');
          break;
        case 'error':
          updateState('error');
          break;
        case 'idle':
          if (
            conversationStateRef.current === 'listening' ||
            conversationStateRef.current === 'processing'
          ) {
            updateState('idle');
          }
          break;
      }
    },
    onError: (errorMessage) => {
      console.error('[VoiceFlow] Voice input error:', errorMessage);
      setError(errorMessage);
      updateState('error');
      onError?.(errorMessage);
    },
    silenceThresholdMs: 3000,
    microphoneSensitivity
  });

  const voiceOutput = useVoiceOutput({
    onFrequencyAnalysis: (data) => {
      const now = performance.now();
      if (now - lastFrequencyUpdateRef.current >= 60) {
        lastFrequencyUpdateRef.current = now;
        setAudioFrequency({
          beat: data.beat,
          amplitude: data.amplitude
        });
      }
    },
    onPlaybackEnd: () => {
      voiceLog('[VoiceFlow] TTS playback ended');
    },
    onError: (errorMessage) => {
      console.error('[VoiceFlow] Voice output error:', errorMessage);
      setError(errorMessage);
      updateState('error');
      onError?.(errorMessage);
    }
  });

  const startListening = useCallback(() => {
    if (autoResumeTimeoutRef.current) {
      clearTimeout(autoResumeTimeoutRef.current);
      autoResumeTimeoutRef.current = null;
    }
    isAutoResumingRef.current = false;
    setError(null);
    void voiceInput.startListening();
  }, [voiceInput]);

  const stopListening = useCallback(() => {
    if (autoResumeTimeoutRef.current) {
      clearTimeout(autoResumeTimeoutRef.current);
      autoResumeTimeoutRef.current = null;
    }

    isAutoResumingRef.current = false;
    voiceInput.stopInterruptDetection();
    voiceInput.stopListening();
    voiceOutput.stop();
    updateState('idle');
  }, [voiceInput, voiceOutput, updateState]);

  const autoResumeListening = useCallback(() => {
    if (isAutoResumingRef.current) {
      return;
    }

    if (!voiceInput.isEnabled) {
      updateState('idle');
      return;
    }

    isAutoResumingRef.current = true;
    updateState('auto-resuming');

    autoResumeTimeoutRef.current = setTimeout(() => {
      isAutoResumingRef.current = false;
      void voiceInput.resumeListening().catch((resumeError: unknown) => {
        const errorMessage = resumeError instanceof Error
          ? resumeError.message
          : 'Resume listening failed';
        setError(errorMessage);
        updateState('error');
        onError?.(errorMessage);
      });
    }, 500);
  }, [voiceInput, onError, updateState]);

  const speakResponse = useCallback(
    async (text: string, autoResume = true) => {
      if (!text.trim()) return;

      setAiResponse(text);
      updateState('speaking');

      let interrupted = false;
      let speakFailed = false;
      if (voiceInput.isEnabled) {
        voiceInput.startInterruptDetection(() => {
          if (interrupted) return;
          interrupted = true;
          voiceLog('[VoiceFlow] Barge-in detected, interrupting TTS');
          voiceOutput.stop();
          void voiceInput.startListening();
          updateState('listening');
        });
      }

      try {
        await voiceOutput.speak(text);
      } catch (speakError: unknown) {
        speakFailed = true;
        const errorMessage = speakError instanceof Error ? speakError.message : 'TTS error';
        setError(errorMessage);
        updateState('error');
        onError?.(errorMessage);
      } finally {
        voiceInput.stopInterruptDetection();
      }

      if (interrupted) {
        return;
      }

      if (speakFailed) {
        return;
      }

      if (autoResume && voiceInput.isEnabled) {
        autoResumeListening();
      } else {
        updateState('idle');
      }
    },
    [voiceInput, voiceOutput, onError, updateState, autoResumeListening]
  );

  const setThinking = useCallback(() => {
    updateState('thinking');
  }, [updateState]);

  const clearError = useCallback(() => {
    setError(null);
    if (conversationStateRef.current === 'error') {
      updateState('idle');
    }
  }, [updateState]);

  const voiceInputRef = useRef(voiceInput);
  const voiceOutputRef = useRef(voiceOutput);

  useEffect(() => {
    voiceInputRef.current = voiceInput;
    voiceOutputRef.current = voiceOutput;
  });

  useEffect(() => {
    return () => {
      if (autoResumeTimeoutRef.current) {
        clearTimeout(autoResumeTimeoutRef.current);
      }
      voiceInputRef.current.stopInterruptDetection();
      voiceInputRef.current.stopListening();
      voiceOutputRef.current.stop();
    };
  }, []);

  return {
    state: conversationState,
    userTranscript,
    transcriptionConfidence,
    aiResponse,
    error,
    audioFrequency,

    isListening: voiceInput.state === 'listening',
    isProcessing: voiceInput.state === 'processing',
    audioLevel: voiceInput.audioLevel,
    voiceEnabled: voiceInput.isEnabled,

    isPlaying: voiceOutput.isPlaying,
    speakingProgress: voiceOutput.progress,

    startListening,
    stopListening,
    speakResponse,
    autoResumeListening,
    setThinking,
    clearError
  };
}
