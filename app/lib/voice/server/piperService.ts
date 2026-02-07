import fs from 'fs';
import os from 'os';
import path from 'path';
import { JsonLineWorkerClient } from './jsonLineWorker';

interface WorkerTtsResponse {
  success: boolean;
  audio_b64: string;
  sample_rate?: number;
  duration_ms?: number;
}

export interface SynthesizeSpeechResult {
  audioBuffer: Buffer;
  sampleRate: number;
  durationMs: number;
  backend: 'piper-worker';
}

const PIPER_TEXT_LIMIT = Number(process.env.PIPER_TEXT_LIMIT || 5000);

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

class PiperService {
  private worker: JsonLineWorkerClient | null = null;
  private activeVoice: string | null = null;

  async synthesize(text: string, voice: string): Promise<SynthesizeSpeechResult> {
    const sanitized = text.trim();
    if (!sanitized) {
      throw new Error('Text cannot be empty');
    }
    if (sanitized.length > PIPER_TEXT_LIMIT) {
      throw new Error(`Text too long (max ${PIPER_TEXT_LIMIT} characters)`);
    }

    const worker = this.ensureWorkerForVoice(voice);

    const response = await worker.request<
      {
        command: 'synthesize';
        text: string;
        length_scale: number;
        volume: number;
      },
      WorkerTtsResponse
    >(
      {
        command: 'synthesize',
        text: sanitized,
        length_scale: parseNumber(process.env.PIPER_LENGTH_SCALE, 0.85),
        volume: parseNumber(process.env.PIPER_VOLUME, 1)
      },
      Number(process.env.PIPER_REQUEST_TIMEOUT_MS || 60000)
    );

    const audioBuffer = Buffer.from(response.audio_b64, 'base64');
    if (audioBuffer.length === 0) {
      throw new Error('Piper worker produced an empty audio payload');
    }

    return {
      audioBuffer,
      sampleRate: response.sample_rate ?? 22050,
      durationMs: response.duration_ms ?? 0,
      backend: 'piper-worker'
    };
  }

  dispose(): void {
    this.worker?.stop();
    this.worker = null;
    this.activeVoice = null;
  }

  getAvailableVoices(query: string = '', limit: number | null = null): {
    voices: string[];
    voiceDir: string;
  } {
    const voiceDir = this.getVoiceDirectory();
    const files = fs.readdirSync(voiceDir);

    let voices = files
      .filter((file) => file.endsWith('.onnx'))
      .map((file) => file.replace(/\.onnx$/i, ''));

    if (query.trim().length > 0) {
      const normalizedQuery = query.trim().toLowerCase();
      voices = voices.filter((voice) => voice.toLowerCase().includes(normalizedQuery));
    }

    if (typeof limit === 'number') {
      voices = voices.slice(0, Math.max(0, limit));
    }

    return { voices, voiceDir };
  }

  private ensureWorkerForVoice(voice: string): JsonLineWorkerClient {
    if (this.worker && this.activeVoice === voice) {
      return this.worker;
    }

    const { modelPath, configPath } = this.resolveVoicePaths(voice);

    this.worker?.stop();
    this.worker = new JsonLineWorkerClient({
      name: `piper-worker:${voice}`,
      scriptPath: path.join(process.cwd(), 'scripts/voice/piper_worker.py'),
      pythonCommand: process.env.PIPER_PYTHON_CMD || 'python3',
      env: {
        PIPER_MODEL_PATH: modelPath,
        ...(configPath ? { PIPER_CONFIG_PATH: configPath } : {}),
        PIPER_USE_CUDA: process.env.PIPER_USE_CUDA || 'false'
      },
      startupTimeoutMs: Number(process.env.PIPER_WORKER_STARTUP_TIMEOUT_MS || 45000)
    });

    this.activeVoice = voice;
    return this.worker;
  }

  private resolveVoicePaths(voice: string): { modelPath: string; configPath: string | null } {
    const voiceDir = this.getVoiceDirectory();
    const modelPath = path.join(voiceDir, `${voice}.onnx`);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Voice model not found: ${voice}`);
    }

    const configPath = `${modelPath}.json`;
    return {
      modelPath,
      configPath: fs.existsSync(configPath) ? configPath : null
    };
  }

  private getVoiceDirectory(): string {
    return process.env.PIPER_MODELS_DIR || path.join(os.homedir(), '.piper', 'models');
  }
}

type GlobalPiperState = {
  __orthoaiPiperService?: PiperService;
  __orthoaiPiperCleanupRegistered?: boolean;
};

const globalPiper = globalThis as typeof globalThis & GlobalPiperState;

export function getPiperService(): PiperService {
  if (!globalPiper.__orthoaiPiperService) {
    globalPiper.__orthoaiPiperService = new PiperService();
  }

  if (!globalPiper.__orthoaiPiperCleanupRegistered) {
    globalPiper.__orthoaiPiperCleanupRegistered = true;

    const cleanup = () => {
      globalPiper.__orthoaiPiperService?.dispose();
    };

    process.once('beforeExit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  return globalPiper.__orthoaiPiperService;
}
