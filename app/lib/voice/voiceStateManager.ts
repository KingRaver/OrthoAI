/**
 * Voice State Manager
 * Centralized state management for voice interaction flow
 * Coordinates: listening → thinking → generating → speaking → ready → listening
 */

export type VoiceState = 
  | 'idle'           // Ready, waiting for user to speak
  | 'listening'      // Recording user speech
  | 'processing'     // Converting speech to text
  | 'thinking'       // LLM is generating response
  | 'generating'     // Converting response to speech
  | 'speaking'       // Playing audio response
  | 'error';         // Error occurred

export interface VoiceContextData {
  state: VoiceState;
  userTranscript: string;
  aiResponse: string;
  audioProgress: number; // 0-1 for TTS playback progress
  audioAmplitude: number; // 0-1 for visualization
  beat: number; // 0-1 for beat detection
  error: string | null;
  isAutoResuming: boolean; // Flag for auto-resume after speaking
}

class VoiceStateManager {
  private state: VoiceContextData = {
    state: 'idle',
    userTranscript: '',
    aiResponse: '',
    audioProgress: 0,
    audioAmplitude: 0,
    beat: 0,
    error: null,
    isAutoResuming: false
  };

  private listeners: Set<(state: VoiceContextData) => void> = new Set();

  subscribe(listener: (state: VoiceContextData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  // State transitions
  setState(newState: VoiceState) {
    this.state.state = newState;
    this.state.error = null;
    this.notify();
  }

  setUserTranscript(transcript: string) {
    this.state.userTranscript = transcript;
    this.notify();
  }

  setAiResponse(response: string) {
    this.state.aiResponse = response;
    this.notify();
  }

  setAudioProgress(progress: number) {
    this.state.audioProgress = Math.min(1, Math.max(0, progress));
    this.notify();
  }

  setAudioAmplitude(amplitude: number) {
    this.state.audioAmplitude = Math.min(1, Math.max(0, amplitude));
    this.notify();
  }

  setBeat(beat: number) {
    this.state.beat = Math.min(1, Math.max(0, beat));
    this.notify();
  }

  setError(error: string | null) {
    this.state.error = error;
    if (error) {
      this.state.state = 'error';
    }
    this.notify();
  }

  setAutoResuming(isResuming: boolean) {
    this.state.isAutoResuming = isResuming;
    this.notify();
  }

  getState(): VoiceContextData {
    return { ...this.state };
  }

  reset() {
    this.state = {
      state: 'idle',
      userTranscript: '',
      aiResponse: '',
      audioProgress: 0,
      audioAmplitude: 0,
      beat: 0,
      error: null,
      isAutoResuming: false
    };
    this.notify();
  }
}

// Singleton instance
let instance: VoiceStateManager | null = null;

export function getVoiceStateManager(): VoiceStateManager {
  if (!instance) {
    instance = new VoiceStateManager();
  }
  return instance;
}