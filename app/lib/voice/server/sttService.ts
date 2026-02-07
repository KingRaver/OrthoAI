import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { setTimeout as delay } from 'timers/promises';
import { JsonLineWorkerClient } from './jsonLineWorker';

const DEBUG_VOICE_SERVER = process.env.DEBUG_VOICE_SERVER === 'true';

const sttLog = (...args: unknown[]) => {
  if (DEBUG_VOICE_SERVER) {
    console.log(...args);
  }
};

type WhisperBackend = 'whispercpp-server' | 'whisper-worker';

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  confidence: number;
  segments: TranscriptionSegment[];
  durationMs: number;
  backend: WhisperBackend;
}

interface WorkerTranscriptionResponse {
  success: boolean;
  text: string;
  language?: string;
  confidence?: number;
  segments?: Array<{
    start?: number;
    end?: number;
    text?: string;
    confidence?: number;
    avg_logprob?: number;
    no_speech_prob?: number;
  }>;
}

const STT_REQUEST_TIMEOUT_MS = Number(process.env.STT_REQUEST_TIMEOUT_MS || 90000);
const STT_SERVER_HEALTH_TIMEOUT_MS = Number(process.env.STT_SERVER_HEALTH_TIMEOUT_MS || 3000);
const STT_SERVER_BOOT_TIMEOUT_MS = Number(process.env.STT_SERVER_BOOT_TIMEOUT_MS || 20000);
const STT_SERVER_COOLDOWN_MS = Number(process.env.STT_SERVER_COOLDOWN_MS || 15000);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function scoreFromLogProb(avgLogProb: number, noSpeechProb: number): number {
  const logProbScore = Math.exp(Math.min(0, avgLogProb));
  return clamp(logProbScore * (1 - clamp(noSpeechProb, 0, 1)), 0, 1);
}

function normalizeSegments(
  rawSegments: unknown[] | undefined
): TranscriptionSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  return rawSegments
    .map((segment) => {
      if (!segment || typeof segment !== 'object') return null;
      const value = segment as Record<string, unknown>;
      const avgLogProb = parseNumber(value.avg_logprob, -0.7);
      const noSpeechProb = parseNumber(value.no_speech_prob, 0);
      const rawConfidence = parseNumber(
        value.confidence,
        scoreFromLogProb(avgLogProb, noSpeechProb)
      );
      const text = typeof value.text === 'string' ? value.text.trim() : '';

      return {
        start: parseNumber(value.start, 0),
        end: parseNumber(value.end, 0),
        text,
        confidence: clamp(rawConfidence, 0, 1)
      } satisfies TranscriptionSegment;
    })
    .filter((segment): segment is TranscriptionSegment => Boolean(segment));
}

function computeAggregateConfidence(
  segments: TranscriptionSegment[],
  fallback: number
): number {
  if (segments.length === 0) {
    return clamp(fallback, 0, 1);
  }

  let weightedSum = 0;
  let totalWeight = 0;

  for (const segment of segments) {
    const durationWeight = Math.max(0.2, segment.end - segment.start);
    const textWeight = Math.max(0.2, segment.text.length / 20);
    const weight = durationWeight + textWeight;
    weightedSum += segment.confidence * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    return clamp(fallback, 0, 1);
  }

  return clamp(weightedSum / totalWeight, 0, 1);
}

function splitArgs(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

class SttService {
  private readonly whisperWorker: JsonLineWorkerClient;
  private whisperServerProcess: ChildProcess | null = null;
  private whisperServerBootPromise: Promise<void> | null = null;
  private whisperServerCooldownUntil = 0;

  constructor() {
    this.whisperWorker = new JsonLineWorkerClient({
      name: 'whisper-worker',
      scriptPath: path.join(process.cwd(), 'scripts/voice/whisper_worker.py'),
      pythonCommand: process.env.WHISPER_PYTHON_CMD || process.env.PIPER_PYTHON_CMD || 'python3',
      env: {
        WHISPER_MODEL: process.env.WHISPER_MODEL || 'small',
        WHISPER_DEVICE: process.env.WHISPER_DEVICE || 'cpu',
      },
      startupTimeoutMs: Number(process.env.WHISPER_WORKER_STARTUP_TIMEOUT_MS || 90000)
    });
  }

  async transcribe(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const backendPreference = (process.env.STT_BACKEND_PREFERENCE || 'auto').toLowerCase();
    const shouldTryWhisperServer = backendPreference !== 'worker';

    if (shouldTryWhisperServer && Date.now() >= this.whisperServerCooldownUntil) {
      try {
        await this.ensureWhisperServer();
        return await this.transcribeViaWhisperServer(audioBuffer);
      } catch (error) {
        this.whisperServerCooldownUntil = Date.now() + STT_SERVER_COOLDOWN_MS;
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[STT] Whisper server unavailable, falling back to worker: ${message}`);
      }
    }

    if (backendPreference === 'whispercpp') {
      throw new Error('whisper.cpp server required but unavailable');
    }

    return this.transcribeViaWorker(audioBuffer);
  }

  dispose(): void {
    this.whisperWorker.stop();

    if (this.whisperServerProcess && this.whisperServerProcess.exitCode === null) {
      this.whisperServerProcess.kill();
    }
    this.whisperServerProcess = null;
  }

  private async transcribeViaWorker(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const start = Date.now();

    const response = await this.whisperWorker.request<
      {
        command: 'transcribe';
        audio_b64: string;
      },
      WorkerTranscriptionResponse
    >(
      {
        command: 'transcribe',
        audio_b64: audioBuffer.toString('base64')
      },
      STT_REQUEST_TIMEOUT_MS
    );

    const text = typeof response.text === 'string' ? response.text.trim() : '';
    const segments = normalizeSegments(response.segments);
    const confidence = computeAggregateConfidence(
      segments,
      parseNumber(response.confidence, text.length > 0 ? 0.75 : 0)
    );

    return {
      text,
      language: typeof response.language === 'string' ? response.language : 'en',
      confidence,
      segments,
      durationMs: Date.now() - start,
      backend: 'whisper-worker'
    };
  }

  private async transcribeViaWhisperServer(audioBuffer: Buffer): Promise<TranscriptionResult> {
    const start = Date.now();
    const baseUrl = process.env.WHISPER_SERVER_URL || 'http://127.0.0.1:8178';
    const endpoint = process.env.WHISPER_SERVER_ENDPOINT || '/inference';
    const fieldName = process.env.WHISPER_SERVER_AUDIO_FIELD || 'file';

    const formData = new FormData();
    formData.append(
      fieldName,
      new Blob([Uint8Array.from(audioBuffer)], { type: 'audio/wav' }),
      'audio.wav'
    );

    // whisper.cpp accepts either snake_case or hyphenated response format depending on build.
    formData.append('response-format', 'json');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STT_REQUEST_TIMEOUT_MS);

    try {
      const url = new URL(endpoint, baseUrl).toString();
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Whisper server returned ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const payload: unknown = contentType.includes('application/json')
        ? await response.json()
        : { text: await response.text() };

      const parsed = this.normalizeServerPayload(payload);
      return {
        ...parsed,
        durationMs: Date.now() - start,
        backend: 'whispercpp-server'
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalizeServerPayload(payload: unknown): Omit<TranscriptionResult, 'durationMs' | 'backend'> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid whisper server response payload');
    }

    const data = payload as Record<string, unknown>;
    const text = typeof data.text === 'string'
      ? data.text.trim()
      : typeof data.result === 'string'
      ? data.result.trim()
      : '';

    const rawSegments = Array.isArray(data.segments)
      ? data.segments
      : Array.isArray((data.result as Record<string, unknown> | undefined)?.segments)
      ? ((data.result as Record<string, unknown>).segments as unknown[])
      : undefined;

    const fallbackConfidence = text.length > 0 ? 0.78 : 0;
    const segments = normalizeSegments(rawSegments);
    const confidence = computeAggregateConfidence(
      segments,
      parseNumber(data.confidence, fallbackConfidence)
    );

    return {
      text,
      language: typeof data.language === 'string' ? data.language : 'en',
      confidence,
      segments
    };
  }

  private async ensureWhisperServer(): Promise<void> {
    if (await this.isWhisperServerReachable()) {
      return;
    }

    const autoStartEnabled =
      process.env.WHISPER_SERVER_AUTO_START === 'true' ||
      Boolean(process.env.WHISPER_SERVER_COMMAND);

    if (!autoStartEnabled) {
      throw new Error('whisper.cpp server is not reachable and auto-start is disabled');
    }

    if (this.whisperServerBootPromise) {
      return this.whisperServerBootPromise;
    }

    this.whisperServerBootPromise = this.startWhisperServerProcess();
    try {
      await this.whisperServerBootPromise;
    } finally {
      this.whisperServerBootPromise = null;
    }
  }

  private async startWhisperServerProcess(): Promise<void> {
    const command = process.env.WHISPER_SERVER_COMMAND || 'whisper-server';
    const args = splitArgs(process.env.WHISPER_SERVER_ARGS || '');

    const existing = this.whisperServerProcess;
    if (existing && existing.exitCode === null) {
      await this.waitForWhisperServer(STT_SERVER_BOOT_TIMEOUT_MS);
      return;
    }

    const child = spawn(command, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.whisperServerProcess = child;
    sttLog(`[STT] Spawned whisper.cpp server PID ${child.pid}`);

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text.length > 0) {
        sttLog(`[STT server] ${text}`);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text.length > 0) {
        console.warn(`[STT server] ${text}`);
      }
    });

    child.on('close', (code, signal) => {
      if (this.whisperServerProcess === child) {
        this.whisperServerProcess = null;
      }
      console.warn(`[STT] whisper.cpp server exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    });

    const startupErrorPromise = new Promise<never>((_, reject) => {
      child.once('error', (error) => {
        reject(new Error(`Failed to start whisper.cpp server: ${error.message}`));
      });
    });

    await Promise.race([
      this.waitForWhisperServer(STT_SERVER_BOOT_TIMEOUT_MS),
      startupErrorPromise
    ]);
  }

  private async waitForWhisperServer(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.isWhisperServerReachable()) {
        return;
      }
      await delay(250);
    }
    throw new Error(`whisper.cpp server failed to become ready within ${timeoutMs}ms`);
  }

  private async isWhisperServerReachable(): Promise<boolean> {
    const baseUrl = process.env.WHISPER_SERVER_URL || 'http://127.0.0.1:8178';
    const endpoint = process.env.WHISPER_SERVER_ENDPOINT || '/inference';
    const healthUrls = [
      new URL('/health', baseUrl).toString(),
      new URL(endpoint, baseUrl).toString()
    ];

    for (const url of healthUrls) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), STT_SERVER_HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });

        if (response.ok || response.status === 405 || response.status === 400 || response.status === 404) {
          return true;
        }
      } catch {
        // Ignore probe failures and keep trying.
      } finally {
        clearTimeout(timeout);
      }
    }

    return false;
  }
}

type GlobalSttState = {
  __orthoaiSttService?: SttService;
  __orthoaiSttCleanupRegistered?: boolean;
};

const globalStt = globalThis as typeof globalThis & GlobalSttState;

export function getSttService(): SttService {
  if (!globalStt.__orthoaiSttService) {
    globalStt.__orthoaiSttService = new SttService();
  }

  if (!globalStt.__orthoaiSttCleanupRegistered) {
    globalStt.__orthoaiSttCleanupRegistered = true;

    const cleanup = () => {
      globalStt.__orthoaiSttService?.dispose();
    };

    process.once('beforeExit', cleanup);
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  return globalStt.__orthoaiSttService;
}
