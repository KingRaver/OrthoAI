// app/lib/voice/audioAnalyzer.ts
'use client';

interface FrequencyData {
  frequency: number;
  amplitude: number;
  spectrum: Uint8Array;
  timestamp: number;
}

export class AudioAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array<ArrayBuffer>;
  private animationFrameId: number | null = null;
  private onAnalysis: (data: FrequencyData) => void;
  private isRunning = false;
  private ownsContext: boolean;

  constructor(onAnalysis: (data: FrequencyData) => void, audioContext?: AudioContext) {
    this.onAnalysis = onAnalysis;

    // Use provided audio context or create a new one
    if (audioContext) {
      this.audioContext = audioContext;
      this.ownsContext = false;
    } else {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.ownsContext = true;
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256; // Fast analysis: 128 frequency bins

    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
  }

  /**
   * Connect microphone or audio element to analyzer
   */
  connectSource(source: AudioNode): void {
    source.connect(this.analyser);
  }

  /**
   * Get the analyser node for manual audio graph connections
   */
  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  /**
   * Start continuous frequency analysis
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.analyze();
  }

  /**
   * Stop frequency analysis
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Continuous analysis loop
   */
  private analyze = (): void => {
    if (!this.isRunning) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Extract dominant frequency and amplitude
    let maxAmplitude = 0;
    let maxFrequencyBin = 0;

    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] > maxAmplitude) {
        maxAmplitude = this.dataArray[i];
        maxFrequencyBin = i;
      }
    }

    // Convert bin index to frequency (Hz)
    const nyquistFrequency = this.audioContext.sampleRate / 2;
    const frequency =
      (maxFrequencyBin / this.analyser.frequencyBinCount) * nyquistFrequency;

    // Normalize amplitude to 0-1 range
    const amplitude = maxAmplitude / 255;

    // Send analysis data
    this.onAnalysis({
      frequency,
      amplitude,
      spectrum: this.dataArray.slice(),
      timestamp: performance.now()
    });

    this.animationFrameId = requestAnimationFrame(this.analyze);
  };

  /**
   * Get average amplitude across frequency spectrum
   */
  getAverageAmplitude(): number {
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    return (sum / this.dataArray.length) / 255;
  }

  /**
   * Get amplitude in a specific frequency range (Hz)
   */
  getAmplitudeInRange(minHz: number, maxHz: number): number {
    const nyquistFrequency = this.audioContext.sampleRate / 2;
    const minBin = Math.floor(
      (minHz / nyquistFrequency) * this.analyser.frequencyBinCount
    );
    const maxBin = Math.ceil(
      (maxHz / nyquistFrequency) * this.analyser.frequencyBinCount
    );

    let sum = 0;
    for (let i = minBin; i < maxBin && i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }

    const range = maxBin - minBin;
    return range > 0 ? (sum / range) / 255 : 0;
  }

  /**
   * Get current frequency spectrum (for advanced visualization)
   */
  getSpectrum(): Uint8Array {
    return this.dataArray.slice();
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    // Only close the audio context if we own it
    if (this.ownsContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

/**
 * Extract beats from audio frequency data (for pulsing effect)
 */
export function extractBeatFromFrequency(
  frequency: number,
  amplitude: number,
  previousAmplitude: number
): number {
  // Speech typically falls in 85-255 Hz range
  // More weight to lower frequencies where speech lives
  const speechRange = frequency >= 85 && frequency <= 255 ? 1.5 : 1;

  // Detect sudden amplitude increase (beat/emphasis)
  const amplitudeDelta = Math.max(0, amplitude - previousAmplitude);
  const beatStrength = amplitudeDelta * 2; // Amplify the delta

  return Math.min(1, (amplitude * speechRange + beatStrength) / 2);
}