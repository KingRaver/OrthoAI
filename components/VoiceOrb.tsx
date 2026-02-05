// components/VoiceOrb.tsx
'use client';

import { useEffect, useRef } from 'react';

interface VoiceOrbProps {
  isListening?: boolean;
  isPlaying?: boolean;
  audioLevel?: number; // 0-1
  beat?: number; // 0-1, emphasis/beat detection
  onToggleListening?: () => void;
  disabled?: boolean;
}

export default function VoiceOrb({
  isListening = false,
  isPlaying = false,
  audioLevel = 0,
  beat = 0,
  onToggleListening,
  disabled = false
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const stateRef = useRef({
    scale: 1,
    pulse: 0,
    rotation: 0,
    targetScale: 1,
    targetPulse: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) / 2 - 20;

    // Animation loop
    const animate = () => {
      // Clear canvas with subtle fade trail
      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Update smooth state
      stateRef.current.targetScale = isListening
        ? 0.85 + audioLevel * 0.3
        : isPlaying
          ? 0.8 + beat * 0.4
          : 0.7;

      stateRef.current.targetPulse = Math.max(audioLevel, beat);

      // Smooth interpolation
      stateRef.current.scale +=
        (stateRef.current.targetScale - stateRef.current.scale) * 0.15;
      stateRef.current.pulse +=
        (stateRef.current.targetPulse - stateRef.current.pulse) * 0.2;
      stateRef.current.rotation += (isListening || isPlaying ? 0.5 : 0.2) * Math.PI / 180;

      const currentRadius = baseRadius * stateRef.current.scale;

      // Draw outer glow (responsive to audio)
      const glowAlpha = 0.3 + stateRef.current.pulse * 0.4;
      for (let i = 3; i > 0; i--) {
        ctx.fillStyle = `rgba(34, 211, 238, ${glowAlpha / i})`;
        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          currentRadius + i * 15,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Draw main orb with gradient
      const gradient = ctx.createRadialGradient(
        centerX - currentRadius * 0.3,
        centerY - currentRadius * 0.3,
        0,
        centerX,
        centerY,
        currentRadius
      );

      if (isListening) {
        // Red/pink listening state
        gradient.addColorStop(0, `rgba(248, 113, 113, ${0.8 + stateRef.current.pulse * 0.2})`);
        gradient.addColorStop(1, `rgba(239, 68, 68, ${0.6 + stateRef.current.pulse * 0.2})`);
      } else if (isPlaying) {
        // Cyan/green playing state
        gradient.addColorStop(0, `rgba(34, 211, 238, ${0.8 + stateRef.current.pulse * 0.2})`);
        gradient.addColorStop(1, `rgba(6, 182, 212, ${0.6 + stateRef.current.pulse * 0.2})`);
      } else {
        // Neutral teal idle state
        gradient.addColorStop(0, `rgba(20, 184, 166, ${0.7})`);
        gradient.addColorStop(1, `rgba(13, 148, 136, ${0.5})`);
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw pulsing rings from center (audio activity)
      if (isListening || isPlaying) {
        const ringCount = 3;
        for (let i = 0; i < ringCount; i++) {
          const ringProgress = (stateRef.current.pulse * 0.7 + i / ringCount) % 1;
          const ringRadius = currentRadius * (0.5 + ringProgress * 0.6);
          const ringAlpha = Math.max(0, 1 - ringProgress);

          ctx.strokeStyle = isListening
            ? `rgba(248, 113, 113, ${ringAlpha * 0.6})`
            : `rgba(34, 211, 238, ${ringAlpha * 0.6})`;

          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Draw rotating accent lines (motion indicator)
      const lineCount = 6;
      for (let i = 0; i < lineCount; i++) {
        const angle =
          (stateRef.current.rotation + (i / lineCount) * Math.PI * 2) % (Math.PI * 2);
        const x1 = centerX + Math.cos(angle) * (currentRadius * 0.6);
        const y1 = centerY + Math.sin(angle) * (currentRadius * 0.6);
        const x2 = centerX + Math.cos(angle) * (currentRadius * 0.85);
        const y2 = centerY + Math.sin(angle) * (currentRadius * 0.85);

        ctx.strokeStyle = `rgba(34, 211, 238, ${0.4 + stateRef.current.pulse * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Draw center dot
      ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + stateRef.current.pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw status indicator arc
      const statusArc = isListening ? 0.5 : isPlaying ? 0.25 : 0.75;
      ctx.strokeStyle = isListening
        ? 'rgba(248, 113, 113, 0.8)'
        : isPlaying
          ? 'rgba(34, 211, 238, 0.8)'
          : 'rgba(20, 184, 166, 0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        currentRadius + 10,
        0,
        statusArc * Math.PI * 2
      );
      ctx.stroke();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening, isPlaying, audioLevel, beat]);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Canvas Orb */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          onClick={disabled ? undefined : onToggleListening}
          className={`${
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'
          } transition-opacity duration-200 drop-shadow-2xl`}
        />

        {/* State Label */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60">
            {isListening ? 'Listening...' : isPlaying ? 'Speaking' : 'Press SPACEBAR'}
          </p>
        </div>
      </div>

      {/* Control Info */}
      <div className="text-center text-xs text-white/50 font-medium space-y-1">
        <p>Hold SPACEBAR to listen</p>
        <p>or click the orb</p>
      </div>
    </div>
  );
}