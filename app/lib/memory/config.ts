// app/lib/memory/config.ts
// Feature flags and configuration for memory system upgrades

/**
 * Memory system feature flags
 * All flags are OFF by default for Phase 1 baseline collection
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
