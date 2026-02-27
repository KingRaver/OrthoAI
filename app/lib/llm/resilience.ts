import { logger } from '@/app/lib/system/logger';

type CircuitState = {
  consecutiveFailures: number;
  openUntilMs: number;
  totalFailures: number;
  totalSuccesses: number;
  lastError?: string;
  lastFailureAt?: string;
};

type RetryConfig = {
  retries: number;
  baseDelayMs: number;
};

const DEFAULT_FAILURE_THRESHOLD = Number(process.env.LLM_CIRCUIT_BREAKER_FAILURE_THRESHOLD || 4);
const DEFAULT_COOLDOWN_MS = Number(process.env.LLM_CIRCUIT_BREAKER_COOLDOWN_MS || 30000);
const DEFAULT_RETRIES = Number(process.env.LLM_REQUEST_RETRIES || 2);
const DEFAULT_RETRY_DELAY_MS = Number(process.env.LLM_RETRY_BASE_DELAY_MS || 500);

const circuitStates = new Map<string, CircuitState>();

function getCircuit(key: string): CircuitState {
  const existing = circuitStates.get(key);
  if (existing) return existing;
  const state: CircuitState = {
    consecutiveFailures: 0,
    openUntilMs: 0,
    totalFailures: 0,
    totalSuccesses: 0,
  };
  circuitStates.set(key, state);
  return state;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    error.name === 'TypeError' ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('429') ||
    message.includes('408') ||
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('network') ||
    message.includes('econnrefused')
  );
}

function normalizeRetryConfig(config?: Partial<RetryConfig>): RetryConfig {
  return {
    retries: Math.max(0, config?.retries ?? DEFAULT_RETRIES),
    baseDelayMs: Math.max(50, config?.baseDelayMs ?? DEFAULT_RETRY_DELAY_MS),
  };
}

export function getFallbackModels(primaryModel: string): string[] {
  const configured = (process.env.LLM_FALLBACK_MODELS || 'biomistral-7b-instruct,meditron-7b')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);

  const ordered = [primaryModel, ...configured];
  return Array.from(new Set(ordered));
}

export async function runWithCircuitBreakerAndRetry<T>(
  key: string,
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const circuit = getCircuit(key);
  const retry = normalizeRetryConfig(config);
  const now = Date.now();

  if (circuit.openUntilMs > now) {
    const remainingMs = circuit.openUntilMs - now;
    throw new Error(`Circuit open for ${key}. Retry in ${remainingMs}ms`);
  }

  let lastError: unknown;
  const totalAttempts = retry.retries + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await operation();
      circuit.consecutiveFailures = 0;
      circuit.totalSuccesses += 1;
      circuit.openUntilMs = 0;
      return result;
    } catch (error) {
      lastError = error;
      circuit.totalFailures += 1;
      circuit.consecutiveFailures += 1;
      circuit.lastError = error instanceof Error ? error.message : String(error);
      circuit.lastFailureAt = new Date().toISOString();

      if (circuit.consecutiveFailures >= DEFAULT_FAILURE_THRESHOLD) {
        circuit.openUntilMs = Date.now() + DEFAULT_COOLDOWN_MS;
        logger.warn('LLM circuit opened', {
          key,
          failureThreshold: DEFAULT_FAILURE_THRESHOLD,
          cooldownMs: DEFAULT_COOLDOWN_MS,
          lastError: circuit.lastError,
        }, 'llm-resilience');
      }

      const isLastAttempt = attempt >= totalAttempts;
      if (isLastAttempt || !isRetryable(error)) {
        break;
      }

      const backoffMs = retry.baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(backoffMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Operation failed for ${key}`);
}

export async function runWithModelFallback<T>(
  primaryModel: string,
  operation: (model: string) => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<{ model: string; result: T }> {
  const models = getFallbackModels(primaryModel);
  const failures: string[] = [];

  for (const model of models) {
    try {
      const result = await runWithCircuitBreakerAndRetry(`llm:${model}`, () => operation(model), config);
      return { model, result };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${model}: ${message}`);
      logger.warn('LLM model attempt failed', { model, error: message }, 'llm-resilience');
    }
  }

  throw new Error(`All models unavailable (${failures.join(' | ')})`);
}

export function getLlmCircuitSnapshot(): Record<string, CircuitState & { state: 'open' | 'closed' }> {
  const now = Date.now();
  const entries: Record<string, CircuitState & { state: 'open' | 'closed' }> = {};

  for (const [key, value] of circuitStates.entries()) {
    entries[key] = {
      ...value,
      state: value.openUntilMs > now ? 'open' : 'closed',
    };
  }

  return entries;
}

export function mapLlmErrorToUserMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes('circuit open')) {
    return 'LLM service is temporarily unavailable while recovering. Please try again shortly.';
  }

  if (normalized.includes('all models unavailable')) {
    return 'All configured models are currently unavailable. Check local model servers and retry.';
  }

  if (normalized.includes('timeout') || normalized.includes('timed out')) {
    return 'The model request timed out. Try a shorter query or retry in a moment.';
  }

  if (normalized.includes('429')) {
    return 'Model server is rate limited right now. Please retry shortly.';
  }

  if (normalized.includes('503') || normalized.includes('502') || normalized.includes('network')) {
    return 'Model server is temporarily unavailable. Verify the local server is running and retry.';
  }

  return 'Model request failed. Please retry. If this continues, check local model server health.';
}

