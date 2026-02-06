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
}

const VoicePanel = forwardRef<VoicePanelHandle, VoicePanelProps>(
  ({ enabled, isLoading, onTranscript, onError, onToggle }, ref) => {
    const voice = useVoiceFlow({
      onTranscript,
      onError,
      onStateChange: () => {}
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
