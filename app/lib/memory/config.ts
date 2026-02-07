// app/lib/memory/config.ts
// Feature flags and configuration for memory system upgrades

/**
 * Memory system feature flags
 * Defaults are conservative and can be overridden via environment variables
 */
export interface MemoryConfig {
  // Phase 3: Hybrid Retrieval
  ragHybrid: boolean;

  // Phase 4: Chunking
  ragChunking: boolean;
  backfillChunks: boolean;

  // Token budget for memory context
  ragTokenBudget: number;

  // Phase 2: Summary generation frequency (0 = disabled)
  ragSummaryFrequency: number;

  // Reranking coefficients (Phase 3)
  ragRerankAlpha: number; // Dense similarity weight
  ragRerankBeta: number;  // BM25 weight
  ragRerankGamma: number; // Code identifier match weight

  // Metrics retention (days)
  metricsRetentionDays: number;

  // Hot-path analytics controls
  retrievalMetricsEnabled: boolean;
  retrievalMetricsSampleRate: number; // 0..1
  searchQueryLoggingEnabled: boolean;
  searchQueryLoggingSampleRate: number; // 0..1

  // Request hardening for background jobs
  summaryRequestTimeoutMs: number;
  summaryRequestRetries: number;
  embeddingRequestTimeoutMs: number;
  embeddingRequestRetries: number;

  // Track C: Summary queue reliability controls
  summaryQueueMaxDepth: number;
  summaryJobMaxAttempts: number;
  summaryRetryBaseDelayMs: number;
  summaryCircuitBreakerFailureThreshold: number;
  summaryCircuitBreakerCooldownMs: number;

  // Debug verbosity control for memory subsystem
  debugMemory: boolean;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function parseIntWithFallback(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFloatWithFallback(value: string | undefined, fallback: number): number {
  const parsed = parseFloat(value || '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Load memory configuration from environment variables
 */
export function getMemoryConfig(): MemoryConfig {
  return {
    ragHybrid: process.env.RAG_HYBRID === 'true',
    ragChunking: process.env.RAG_CHUNKING === 'true',
    backfillChunks: process.env.BACKFILL_CHUNKS === 'true',
    ragTokenBudget: parseInt(process.env.RAG_TOKEN_BUDGET || '1000', 10),
    ragSummaryFrequency: parseInt(process.env.RAG_SUMMARY_FREQUENCY || '5', 10),
    ragRerankAlpha: parseFloat(process.env.RAG_RERANK_ALPHA || '0.6'),
    ragRerankBeta: parseFloat(process.env.RAG_RERANK_BETA || '0.3'),
    ragRerankGamma: parseFloat(process.env.RAG_RERANK_GAMMA || '0.1'),
    metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '30', 10),
    retrievalMetricsEnabled: parseBoolean(process.env.RAG_METRICS_ENABLED, true),
    retrievalMetricsSampleRate: parseFloatWithFallback(process.env.RAG_METRICS_SAMPLE_RATE, 1),
    searchQueryLoggingEnabled: parseBoolean(process.env.RAG_SEARCH_QUERY_LOGGING, true),
    searchQueryLoggingSampleRate: parseFloatWithFallback(process.env.RAG_SEARCH_QUERY_SAMPLE_RATE, 1),
    summaryRequestTimeoutMs: parseIntWithFallback(process.env.SUMMARY_REQUEST_TIMEOUT_MS, 45000),
    summaryRequestRetries: parseIntWithFallback(process.env.SUMMARY_REQUEST_RETRIES, 1),
    embeddingRequestTimeoutMs: parseIntWithFallback(process.env.EMBEDDING_REQUEST_TIMEOUT_MS, 15000),
    embeddingRequestRetries: parseIntWithFallback(process.env.EMBEDDING_REQUEST_RETRIES, 2),
    summaryQueueMaxDepth: parseIntWithFallback(process.env.SUMMARY_QUEUE_MAX_DEPTH, 64),
    summaryJobMaxAttempts: parseIntWithFallback(process.env.SUMMARY_JOB_MAX_ATTEMPTS, 3),
    summaryRetryBaseDelayMs: parseIntWithFallback(process.env.SUMMARY_RETRY_BASE_DELAY_MS, 400),
    summaryCircuitBreakerFailureThreshold: parseIntWithFallback(
      process.env.SUMMARY_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      5
    ),
    summaryCircuitBreakerCooldownMs: parseIntWithFallback(
      process.env.SUMMARY_CIRCUIT_BREAKER_COOLDOWN_MS,
      60000
    ),
    debugMemory: parseBoolean(process.env.DEBUG_MEMORY, false) || parseBoolean(process.env.DEBUG_METRICS, false),
  };
}

/**
 * Validate configuration values
 */
export function validateMemoryConfig(config: MemoryConfig): string[] {
  const errors: string[] = [];

  if (config.ragTokenBudget < 100 || config.ragTokenBudget > 5000) {
    errors.push('RAG_TOKEN_BUDGET must be between 100 and 5000');
  }

  if (config.ragSummaryFrequency < 0 || config.ragSummaryFrequency > 100) {
    errors.push('RAG_SUMMARY_FREQUENCY must be between 0 and 100');
  }

  const alphaSum = config.ragRerankAlpha + config.ragRerankBeta + config.ragRerankGamma;
  if (Math.abs(alphaSum - 1.0) > 0.01) {
    errors.push(`Rerank coefficients must sum to 1.0 (current: ${alphaSum.toFixed(2)})`);
  }

  if (config.metricsRetentionDays < 1 || config.metricsRetentionDays > 365) {
    errors.push('METRICS_RETENTION_DAYS must be between 1 and 365');
  }

  if (config.retrievalMetricsSampleRate < 0 || config.retrievalMetricsSampleRate > 1) {
    errors.push('RAG_METRICS_SAMPLE_RATE must be between 0 and 1');
  }

  if (config.searchQueryLoggingSampleRate < 0 || config.searchQueryLoggingSampleRate > 1) {
    errors.push('RAG_SEARCH_QUERY_SAMPLE_RATE must be between 0 and 1');
  }

  if (config.summaryRequestTimeoutMs < 1000 || config.summaryRequestTimeoutMs > 300000) {
    errors.push('SUMMARY_REQUEST_TIMEOUT_MS must be between 1000 and 300000');
  }

  if (config.summaryRequestRetries < 0 || config.summaryRequestRetries > 5) {
    errors.push('SUMMARY_REQUEST_RETRIES must be between 0 and 5');
  }

  if (config.embeddingRequestTimeoutMs < 1000 || config.embeddingRequestTimeoutMs > 120000) {
    errors.push('EMBEDDING_REQUEST_TIMEOUT_MS must be between 1000 and 120000');
  }

  if (config.embeddingRequestRetries < 0 || config.embeddingRequestRetries > 5) {
    errors.push('EMBEDDING_REQUEST_RETRIES must be between 0 and 5');
  }

  if (config.summaryQueueMaxDepth < 1 || config.summaryQueueMaxDepth > 10000) {
    errors.push('SUMMARY_QUEUE_MAX_DEPTH must be between 1 and 10000');
  }

  if (config.summaryJobMaxAttempts < 1 || config.summaryJobMaxAttempts > 10) {
    errors.push('SUMMARY_JOB_MAX_ATTEMPTS must be between 1 and 10');
  }

  if (config.summaryRetryBaseDelayMs < 10 || config.summaryRetryBaseDelayMs > 60000) {
    errors.push('SUMMARY_RETRY_BASE_DELAY_MS must be between 10 and 60000');
  }

  if (config.summaryCircuitBreakerFailureThreshold < 1 || config.summaryCircuitBreakerFailureThreshold > 100) {
    errors.push('SUMMARY_CIRCUIT_BREAKER_FAILURE_THRESHOLD must be between 1 and 100');
  }

  if (config.summaryCircuitBreakerCooldownMs < 1000 || config.summaryCircuitBreakerCooldownMs > 3600000) {
    errors.push('SUMMARY_CIRCUIT_BREAKER_COOLDOWN_MS must be between 1000 and 3600000');
  }

  return errors;
}

/**
 * Get config with validation
 * Logs warnings for invalid configs but doesn't throw
 */
export function getValidatedMemoryConfig(): MemoryConfig {
  const config = getMemoryConfig();
  const errors = validateMemoryConfig(config);

  if (errors.length > 0) {
    console.warn('[MemoryConfig] Configuration warnings:');
    errors.forEach(err => console.warn(`  - ${err}`));
  }

  return config;
}
