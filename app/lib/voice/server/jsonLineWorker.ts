import { randomUUID } from 'crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import * as readline from 'readline';

type JsonObject = Record<string, unknown>;

interface PendingRequest {
  resolve: (value: JsonObject) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface JsonLineWorkerOptions {
  name: string;
  scriptPath: string;
  pythonCommand?: string;
  env?: Record<string, string | undefined>;
  startupTimeoutMs?: number;
}

const DEBUG_VOICE_SERVER = process.env.DEBUG_VOICE_SERVER === 'true';

const voiceServerLog = (...args: unknown[]) => {
  if (DEBUG_VOICE_SERVER) {
    console.log(...args);
  }
};

export class JsonLineWorkerClient {
  private readonly options: JsonLineWorkerOptions;
  private process: ChildProcessWithoutNullStreams | null = null;
  private lineReader: readline.Interface | null = null;
  private pending = new Map<string, PendingRequest>();
  private startupPromise: Promise<void> | null = null;
  private startupResolve: (() => void) | null = null;
  private startupReject: ((error: Error) => void) | null = null;
  private startupTimeout: NodeJS.Timeout | null = null;
  private ready = false;

  constructor(options: JsonLineWorkerOptions) {
    this.options = options;
  }

  async request<TPayload extends JsonObject, TResponse>(
    payload: TPayload,
    timeoutMs: number = 60000
  ): Promise<TResponse> {
    await this.ensureStarted();

    if (!this.process || !this.ready) {
      throw new Error(`[${this.options.name}] Worker is not ready`);
    }

    const id = randomUUID();
    const envelope: JsonObject = { id, ...payload };
    const payloadString = `${JSON.stringify(envelope)}\n`;

    return new Promise<TResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`[${this.options.name}] Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, {
        resolve: (value) => resolve(value as TResponse),
        reject,
        timeout
      });

      this.process!.stdin.write(payloadString, (writeError) => {
        if (!writeError) return;

        const pending = this.pending.get(id);
        if (!pending) return;
        clearTimeout(pending.timeout);
        this.pending.delete(id);
        pending.reject(
          new Error(`[${this.options.name}] Failed to write request to worker: ${writeError.message}`)
        );
      });
    });
  }

  stop(): void {
    this.cleanupStartup(new Error(`[${this.options.name}] Worker stopped`));
    this.rejectPending(new Error(`[${this.options.name}] Worker stopped`));

    if (this.lineReader) {
      this.lineReader.close();
      this.lineReader = null;
    }

    if (this.process && this.process.exitCode === null) {
      this.process.kill();
    }

    this.process = null;
    this.ready = false;
    this.startupPromise = null;
  }

  private async ensureStarted(): Promise<void> {
    if (this.process && this.ready) {
      return;
    }

    if (this.startupPromise) {
      return this.startupPromise;
    }

    const startupTimeoutMs = this.options.startupTimeoutMs ?? 45000;
    const pythonCommand = this.options.pythonCommand || process.env.PYTHON_BIN || 'python3';

    this.startupPromise = new Promise<void>((resolve, reject) => {
      this.startupResolve = resolve;
      this.startupReject = reject;

      const child = spawn(pythonCommand, ['-u', this.options.scriptPath], {
        env: {
          ...process.env,
          ...this.options.env,
        } as NodeJS.ProcessEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process = child;
      this.ready = false;

      voiceServerLog(`[${this.options.name}] Spawned worker PID ${child.pid}`);

      const lineReader = readline.createInterface({
        input: child.stdout
      });
      this.lineReader = lineReader;

      lineReader.on('line', (line) => {
        this.handleWorkerLine(line);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString().trim();
        if (text.length > 0) {
          console.warn(`[${this.options.name}] ${text}`);
        }
      });

      child.on('error', (error) => {
        const workerError = new Error(`[${this.options.name}] Worker process error: ${error.message}`);
        this.cleanupStartup(workerError);
        this.rejectPending(workerError);
        this.ready = false;
      });

      child.on('close', (code, signal) => {
        const closeError = new Error(
          `[${this.options.name}] Worker exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
        );
        this.cleanupStartup(closeError);
        this.rejectPending(closeError);
        this.ready = false;
        this.process = null;
        this.startupPromise = null;
      });

      this.startupTimeout = setTimeout(() => {
        const timeoutError = new Error(
          `[${this.options.name}] Worker startup timed out after ${startupTimeoutMs}ms`
        );
        this.cleanupStartup(timeoutError);
        this.rejectPending(timeoutError);
        this.stop();
      }, startupTimeoutMs);
    });

    return this.startupPromise;
  }

  private handleWorkerLine(line: string): void {
    let parsed: JsonObject | null = null;

    try {
      parsed = JSON.parse(line) as JsonObject;
    } catch {
      console.warn(`[${this.options.name}] Invalid JSON from worker: ${line}`);
      return;
    }

    if (parsed.event === 'ready') {
      this.ready = true;
      this.cleanupStartup();
      voiceServerLog(`[${this.options.name}] Worker ready`);
      return;
    }

    const id = typeof parsed.id === 'string' ? parsed.id : null;
    if (!id) {
      return;
    }

    const pending = this.pending.get(id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(id);

    if (parsed.success === false) {
      const errorMessage = typeof parsed.error === 'string'
        ? parsed.error
        : 'Worker request failed';
      pending.reject(new Error(`[${this.options.name}] ${errorMessage}`));
      return;
    }

    pending.resolve(parsed);
  }

  private rejectPending(error: Error): void {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private cleanupStartup(error?: Error): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = null;
    }

    if (error) {
      this.startupReject?.(error);
    } else {
      this.startupResolve?.();
    }

    this.startupResolve = null;
    this.startupReject = null;
    this.startupPromise = null;
  }
}
