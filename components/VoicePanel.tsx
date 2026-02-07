'use client';

import { forwardRef, useEffect, useImperativeHandle } from 'react';
import ParticleOrb from './ParticleOrb';
import { useVoiceFlow } from '@/app/lib/voice/useVoiceFlow';
import type { VoiceState } from '@/app/lib/voice/voiceStateManager';

export interface VoicePanelHandle {
  speakResponse: (text: string, autoResume?: boolean) => Promise<void>;
  setThinking: () => void;
  stop: () => void;
}

interface VoicePanelProps {
  enabled: boolean;
  isLoading: boolean;
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  onToggle: () => void;
  microphoneSensitivity?: number;
}

const VoicePanel = forwardRef<VoicePanelHandle, VoicePanelProps>(
  ({
    enabled,
    isLoading,
    onTranscript,
    onError,
    onToggle,
    microphoneSensitivity = 1
  }, ref) => {
    const voice = useVoiceFlow({
      onTranscript,
      onError,
      onStateChange: () => {},
      microphoneSensitivity
    });

    useImperativeHandle(ref, () => ({
      speakResponse: voice.speakResponse,
      setThinking: voice.setThinking,
      stop: voice.stopListening
    }));

    useEffect(() => {
      if (enabled) {
        voice.startListening();
      } else {
        voice.stopListening();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    const orbState: VoiceState =
      voice.state === 'auto-resuming' ? 'listening' : voice.state;
    const confidencePercent = voice.transcriptionConfidence !== null
      ? Math.round(voice.transcriptionConfidence * 100)
      : null;
    const confidenceTone = confidencePercent === null
      ? null
      : confidencePercent >= 85
      ? 'text-emerald-700 bg-emerald-100'
      : confidencePercent >= 65
      ? 'text-amber-700 bg-amber-100'
      : 'text-red-700 bg-red-100';

    return (
      <div className="flex flex-col items-center gap-6 py-6">
        <ParticleOrb
          state={orbState}
          audioLevel={voice.audioLevel}
          beat={voice.audioFrequency.beat}
          disabled={isLoading || !enabled}
          onClick={onToggle}
        />

        {voice.error && (
          <div className="text-center text-red-600 text-sm font-medium">
            {voice.error}
          </div>
        )}

        {voice.state === 'processing' && (
          <div className="flex items-center gap-2 rounded-full px-3 py-1 bg-cyan-light/30 text-slate-700 text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
            Transcribing audio...
          </div>
        )}

        {voice.userTranscript && (
          <div className="max-w-xl rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 shadow-sm">
            <div className="font-semibold text-slate-600 mb-1">Last transcript</div>
            <div className="leading-relaxed">{voice.userTranscript}</div>
          </div>
        )}

        {confidencePercent !== null && confidenceTone && (
          <div className={`rounded-full px-3 py-1 text-xs font-semibold ${confidenceTone}`}>
            STT confidence: {confidencePercent}%
          </div>
        )}

        {voice.state === 'auto-resuming' && (
          <div className="text-center text-teal/70 text-xs font-medium animate-pulse">
            Ready to listen...
          </div>
        )}
      </div>
    );
  }
);

VoicePanel.displayName = 'VoicePanel';

export default VoicePanel;
