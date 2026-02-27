import { logger } from './logger';

type CleanupHandler = {
  name: string;
  fn: () => Promise<void> | void;
  timeoutMs: number;
};

type ShutdownState = {
  shuttingDown: boolean;
  startedAt: number | null;
  activeRequests: number;
  handlers: Map<string, CleanupHandler>;
  handlersInstalled: boolean;
  shutdownPromise: Promise<void> | null;
};

const DEFAULT_HANDLER_TIMEOUT_MS = Number(process.env.SHUTDOWN_HANDLER_TIMEOUT_MS || 8000);
const DEFAULT_DRAIN_TIMEOUT_MS = Number(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS || 15000);

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(value => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

function getState(): ShutdownState {
  const globalState = globalThis as typeof globalThis & {
    __orthoaiShutdownState?: ShutdownState;
  };

  if (!globalState.__orthoaiShutdownState) {
    globalState.__orthoaiShutdownState = {
      shuttingDown: false,
      startedAt: null,
      activeRequests: 0,
      handlers: new Map<string, CleanupHandler>(),
      handlersInstalled: false,
      shutdownPromise: null,
    };
  }

  return globalState.__orthoaiShutdownState;
}

export function registerShutdownHandler(
  name: string,
  fn: () => Promise<void> | void,
  timeoutMs = DEFAULT_HANDLER_TIMEOUT_MS
): () => void {
  const state = getState();
  state.handlers.set(name, {
    name,
    fn,
    timeoutMs: Math.max(500, timeoutMs),
  });
  return () => {
    const current = getState();
    current.handlers.delete(name);
  };
}

export function beginTrackedRequest(): () => void {
  const state = getState();
  state.activeRequests += 1;

  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    const next = getState();
    next.activeRequests = Math.max(0, next.activeRequests - 1);
  };
}

export function getShutdownSnapshot(): {
  shuttingDown: boolean;
  startedAt: string | null;
  activeRequests: number;
  handlerCount: number;
} {
  const state = getState();
  return {
    shuttingDown: state.shuttingDown,
    startedAt: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    activeRequests: state.activeRequests,
    handlerCount: state.handlers.size,
  };
}

export function isShuttingDown(): boolean {
  return getState().shuttingDown;
}

async function drainInFlightRequests(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (getState().activeRequests === 0) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error(`Request drain timed out after ${timeoutMs}ms`);
}

async function runCleanupHandlers(): Promise<void> {
  const state = getState();
  const handlers = Array.from(state.handlers.values());

  for (const handler of handlers) {
    const startedAt = Date.now();
    try {
      await withTimeout(Promise.resolve(handler.fn()), handler.timeoutMs, `cleanup:${handler.name}`);
      logger.info('Cleanup handler completed', {
        handler: handler.name,
        durationMs: Date.now() - startedAt,
      }, 'shutdown');
    } catch (error) {
      logger.warn('Cleanup handler failed', {
        handler: handler.name,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      }, 'shutdown');
    }
  }
}

async function executeShutdown(signal: string): Promise<void> {
  const state = getState();
  if (state.shutdownPromise) {
    return state.shutdownPromise;
  }

  state.shuttingDown = true;
  state.startedAt = Date.now();

  state.shutdownPromise = (async () => {
    logger.warn('Shutdown initiated', { signal }, 'shutdown');

    try {
      await drainInFlightRequests(DEFAULT_DRAIN_TIMEOUT_MS);
      logger.info('Request drain complete', { activeRequests: 0 }, 'shutdown');
    } catch (error) {
      logger.warn('Request drain incomplete', {
        activeRequests: getState().activeRequests,
        error: error instanceof Error ? error.message : String(error),
      }, 'shutdown');
    }

    await runCleanupHandlers();
    logger.info('Shutdown cleanup finished', {}, 'shutdown');
  })();

  return state.shutdownPromise;
}

export function installShutdownHandlers(): void {
  const state = getState();
  if (state.handlersInstalled) return;
  state.handlersInstalled = true;

  process.once('SIGTERM', () => {
    void executeShutdown('SIGTERM');
  });

  process.once('SIGINT', () => {
    void executeShutdown('SIGINT');
  });
}

