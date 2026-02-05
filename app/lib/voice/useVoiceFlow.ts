/**
 * useVoiceFlow Hook
 * Unified voice interaction combining Whisper STT, TTS, and auto-resume logic
 * Manages the conversation flow: listen → transcribe → think → speak → auto-listen
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoiceInput } from './useVoiceInput';
import { useVoiceOutput } from './useVoiceOutput';

type ConversationState = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'auto-resuming' | 'error';

interface UseVoiceFlowProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  onStateChange?: (state: ConversationState) => void;
}

export function useVoiceFlow({ onTranscript, onError, onStateChange }: UseVoiceFlowProps) {
  // Conversation state machine
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [audioFrequency, setAudioFrequency] = useState({ beat: 0, amplitude: 0 });
  const [userTranscript, setUserTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const autoResumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoResumingRef = useRef(false);

  // Update conversation state
  const updateState = useCallback((newState: ConversationState) => {
    setConversationState(newState);
    onStateChange?.(newState);
    console.log(`[VoiceFlow] State: ${newState}`);
  }, [onStateChange]);

  // Voice input (STT with Whisper)
  const voiceInput = useVoiceInput({
    onTranscript: (text) => {
      console.log(`[VoiceFlow] Transcript received: "${text}"`);
      setUserTranscript(text);
      updateState('processing');

      // Fire callback to send to LLM (Chat.tsx handles this)
      onTranscript(text);
    },
    onStateChange: (inputState) => {
      // Map voice input state to conversation state
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
          // Only update to idle if we're not already in another state
          if (conversationState === 'listening' || conversationState === 'processing') {
            updateState('idle');
          }
          break;
      }
    },
    onError: (errorMsg) => {
      console.error('[VoiceFlow] Voice input error:', errorMsg);
      setError(errorMsg);
      updateState('error');
      onError?.(errorMsg);
    },
    silenceThresholdMs: 3000 // 3 seconds of silence = end of speech
  });

  // Voice output (TTS)
  const voiceOutput = useVoiceOutput({
    onFrequencyAnalysis: (data) => {
      setAudioFrequency({
        beat: data.beat,
        amplitude: data.amplitude
      });
    },
    onPlaybackEnd: () => {
      console.log('[VoiceFlow] TTS finished - auto-resuming listening');
      // Auto-resume listening after TTS finishes (seamless conversation loop)
      autoResumeListening();
    },
    onError: (errorMsg) => {
      console.error('[VoiceFlow] Voice output error:', errorMsg);
      setError(errorMsg);
      updateState('error');
      onError?.(errorMsg);
    }
  });

  /**
   * Start voice conversation:
   * 1. Initialize audio and start listening
   * 2. Detect speech and silence
   * 3. Send transcript to Chat.tsx
   */
  const startListening = useCallback(() => {
    console.log('[VoiceFlow] Starting listening...');

    // Clear any pending auto-resume
    if (autoResumeTimeoutRef.current) {
      clearTimeout(autoResumeTimeoutRef.current);
      autoResumeTimeoutRef.current = null;
    }
    isAutoResumingRef.current = false;

    // Clear previous transcript
    setUserTranscript('');
    setError(null);

    // Start voice input
    voiceInput.startListening();
  }, [voiceInput]);

  /**
   * Stop listening immediately
   * Called when voice toggle is turned OFF
   */
  const stopListening = useCallback(() => {
    console.log('[VoiceFlow] Stopping listening...');

    // Cancel auto-resume if pending
    if (autoResumeTimeoutRef.current) {
      clearTimeout(autoResumeTimeoutRef.current);
      autoResumeTimeoutRef.current = null;
    }
    isAutoResumingRef.current = false;

    // Stop voice input and TTS
    voiceInput.stopListening();
    voiceOutput.stop();

    updateState('idle');
  }, [voiceInput, voiceOutput]);

  /**
   * Speak AI response and auto-resume listening
   * Called by Chat.tsx when LLM has generated response
   * 
   * @param text - The AI response text to speak
   * @param autoResume - Whether to auto-resume listening after speaking (default: true)
   */
  const speakResponse = useCallback(
    async (text: string, autoResume = true) => {
      if (!text.trim()) {
        console.warn('[VoiceFlow] Empty response text');
        return;
      }

      console.log(`[VoiceFlow] Speaking response: "${text.substring(0, 50)}..."`);

      setAiResponse(text);
      updateState('speaking');

      try {
        // Speak the response
        await voiceOutput.speak(text);

        console.log('[VoiceFlow] Speech finished');

        // After speech finishes, decide what to do
        if (autoResume && voiceInput.isEnabled) {
          // Auto-resume listening (seamless conversation loop)
          autoResumeListening();
        } else {
          // Stop and wait for manual restart
          updateState('idle');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'TTS error';
        console.error('[VoiceFlow] TTS error:', errorMsg);
        setError(errorMsg);
        updateState('error');
        onError?.(errorMsg);
      }
    },
    [voiceOutput, voiceInput.isEnabled, onError]
  );

  /**
   * Auto-resume listening after a short delay
   * Gives user time to start speaking naturally
   */
  const autoResumeListening = useCallback(() => {
    // Prevent double auto-resume
    if (isAutoResumingRef.current) {
      console.warn('[VoiceFlow] Auto-resume already in progress');
      return;
    }

    // Only auto-resume if voice is still enabled
    if (!voiceInput.isEnabled) {
      console.log('[VoiceFlow] Voice is disabled - not auto-resuming');
      updateState('idle');
      return;
    }

    console.log('[VoiceFlow] Auto-resuming in 500ms...');
    isAutoResumingRef.current = true;
    updateState('auto-resuming');

    // Brief delay (0.5 seconds) before resuming to give user time to start speaking
    autoResumeTimeoutRef.current = setTimeout(() => {
      isAutoResumingRef.current = false;

      // Use resumeListening() for seamless loop (doesn't reinitialize audio)
      voiceInput.resumeListening().catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Resume listening failed';
        console.error('[VoiceFlow] Resume listening error:', errorMsg);
        setError(errorMsg);
        updateState('error');
        onError?.(errorMsg);
      });
    }, 500);
  }, [voiceInput, onError]);

  /**
   * Notify that LLM is thinking (for UI feedback)
   */
  const setThinking = useCallback(() => {
    console.log('[VoiceFlow] LLM thinking...');
    updateState('thinking');
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    // Return to idle if in error state
    if (conversationState === 'error') {
      updateState('idle');
    }
  }, [conversationState]);

  // Store the voice hooks in refs to avoid recreating cleanup on every render
  const voiceInputRef = useRef(voiceInput);
  const voiceOutputRef = useRef(voiceOutput);

  useEffect(() => {
    voiceInputRef.current = voiceInput;
    voiceOutputRef.current = voiceOutput;
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[VoiceFlow] Cleaning up...');

      // Clear timeouts
      if (autoResumeTimeoutRef.current) {
        clearTimeout(autoResumeTimeoutRef.current);
      }

      // Stop listening and speaking using refs to avoid dependency issues
      voiceInputRef.current.stopListening();
      voiceOutputRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on unmount

  return {
    // Conversation state and data
    state: conversationState,
    userTranscript,
    aiResponse,
    error,
    audioFrequency,

    // Voice input state
    isListening: voiceInput.state === 'listening',
    isProcessing: voiceInput.state === 'processing',
    audioLevel: voiceInput.audioLevel,
    voiceEnabled: voiceInput.isEnabled,

    // Voice output state
    isPlaying: voiceOutput.isPlaying,
    speakingProgress: voiceOutput.progress,

    // Control methods
    startListening,
    stopListening,
    speakResponse,
    autoResumeListening,
    setThinking,
    clearError
  };
}