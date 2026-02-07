// app/lib/llm/config.ts

const DEFAULT_LLM_BASE_URL = 'http://localhost:8080/v1';
const DEFAULT_LLM_TIMEOUT_MS = 900000; // 15 minutes
const MIN_LLM_TIMEOUT_MS = 600000; // 10 minutes
const MAX_LLM_TIMEOUT_MS = 1200000; // 20 minutes

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getLlmBaseUrl(): string {
  return normalizeBaseUrl(process.env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL);
}

export function getLlmChatUrl(): string {
  return `${getLlmBaseUrl()}/chat/completions`;
}

/**
 * Model-to-endpoint mapping for multi-server deployments
 *
 * Supported config methods (checked in order):
 * 1. LLM_BASE_URL_<MODEL> env vars (e.g., LLM_BASE_URL_BIOGPT=http://localhost:8082/v1)
 * 2. MODEL_ENDPOINTS JSON env var
 * 3. Falls back to LLM_BASE_URL
 */

function getModelEndpointFromEnv(model: string): string | undefined {
  // Convert model name to env var format: biogpt -> BIOGPT, biomistral-7b-instruct -> BIOMISTRAL_7B_INSTRUCT
  const envKey = `LLM_BASE_URL_${model.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey];
}

function getModelEndpointsFromJson(): Record<string, string> {
  const envValue = process.env.MODEL_ENDPOINTS;
  if (!envValue) return {};

  try {
    return JSON.parse(envValue) as Record<string, string>;
  } catch {
    console.warn('[Config] Failed to parse MODEL_ENDPOINTS JSON, using individual env vars');
    return {};
  }
}

export function getLlmChatUrlForModel(model: string): string {
  // First check for model-specific env var (LLM_BASE_URL_BIOGPT, etc.)
  const envEndpoint = getModelEndpointFromEnv(model);
  if (envEndpoint) {
    return `${normalizeBaseUrl(envEndpoint)}/chat/completions`;
  }

  // Then check MODEL_ENDPOINTS JSON
  const jsonEndpoints = getModelEndpointsFromJson();
  if (jsonEndpoints[model]) {
    return `${normalizeBaseUrl(jsonEndpoints[model])}/chat/completions`;
  }

  // Fall back to default LLM_BASE_URL
  return `${getLlmBaseUrl()}/chat/completions`;
}

export function getLlmApiKey(): string {
  return process.env.LLM_API_KEY || 'llama.cpp';
}

export function getDefaultModel(): string {
  return process.env.LLM_DEFAULT_MODEL || 'biomistral-7b-instruct';
}

export function getEmbeddingBaseUrl(): string {
  const base = process.env.EMBEDDING_BASE_URL || process.env.LLM_BASE_URL || DEFAULT_LLM_BASE_URL;
  return normalizeBaseUrl(base);
}

export function getEmbeddingUrl(): string {
  return `${getEmbeddingBaseUrl()}/embeddings`;
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || 'nomic-embed-text';
}

export function getLlmRequestTimeoutMs(): number {
  const raw = parseInt(process.env.LLM_REQUEST_TIMEOUT_MS || `${DEFAULT_LLM_TIMEOUT_MS}`, 10);
  if (Number.isNaN(raw)) {
    return DEFAULT_LLM_TIMEOUT_MS;
  }
  if (raw < MIN_LLM_TIMEOUT_MS) return MIN_LLM_TIMEOUT_MS;
  if (raw > MAX_LLM_TIMEOUT_MS) return MAX_LLM_TIMEOUT_MS;
  return raw;
}
