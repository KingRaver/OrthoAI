import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyMemoryRuntimePreferencesToEnv,
  getMemoryRuntimePreferencesFromEnv,
  normalizeMemoryRuntimePreferences,
  persistMemoryRuntimePreferences,
  readMemoryRuntimePreferencesFromStorage,
  type MemoryRuntimePreferences,
} from '@/app/lib/memory/preferences';
import { getMemoryConfig, validateMemoryConfig } from '@/app/lib/memory/config';
import type { SQLiteStorage } from '@/app/lib/memory/storage/sqlite';

function clearMemoryEnv(): void {
  delete process.env.RAG_HYBRID;
  delete process.env.RAG_CHUNKING;
  delete process.env.BACKFILL_CHUNKS;
  delete process.env.RAG_TOKEN_BUDGET;
  delete process.env.RAG_SUMMARY_FREQUENCY;
  delete process.env.RAG_RERANK_ALPHA;
  delete process.env.RAG_RERANK_BETA;
  delete process.env.RAG_RERANK_GAMMA;
  delete process.env.METRICS_RETENTION_DAYS;
  delete process.env.RAG_METRICS_SAMPLE_RATE;
  delete process.env.RAG_SEARCH_QUERY_SAMPLE_RATE;
  delete process.env.SUMMARY_REQUEST_TIMEOUT_MS;
  delete process.env.SUMMARY_REQUEST_RETRIES;
  delete process.env.EMBEDDING_REQUEST_TIMEOUT_MS;
  delete process.env.EMBEDDING_REQUEST_RETRIES;
  delete process.env.SUMMARY_QUEUE_MAX_DEPTH;
  delete process.env.SUMMARY_JOB_MAX_ATTEMPTS;
  delete process.env.SUMMARY_RETRY_BASE_DELAY_MS;
  delete process.env.SUMMARY_CIRCUIT_BREAKER_FAILURE_THRESHOLD;
  delete process.env.SUMMARY_CIRCUIT_BREAKER_COOLDOWN_MS;
  delete process.env.DEBUG_MEMORY;
  delete process.env.DEBUG_METRICS;
}

describe('memory config + preferences', () => {
  afterEach(() => {
    clearMemoryEnv();
    vi.restoreAllMocks();
  });

  it('parses memory config from environment', () => {
    process.env.RAG_HYBRID = 'true';
    process.env.RAG_CHUNKING = 'true';
    process.env.RAG_TOKEN_BUDGET = '1400';
    process.env.RAG_SUMMARY_FREQUENCY = '9';
    process.env.RAG_METRICS_SAMPLE_RATE = '0.25';
    process.env.RAG_SEARCH_QUERY_SAMPLE_RATE = '0.1';
    process.env.DEBUG_METRICS = 'true';

    const config = getMemoryConfig();

    expect(config.ragHybrid).toBe(true);
    expect(config.ragChunking).toBe(true);
    expect(config.ragTokenBudget).toBe(1400);
    expect(config.ragSummaryFrequency).toBe(9);
    expect(config.retrievalMetricsSampleRate).toBe(0.25);
    expect(config.searchQueryLoggingSampleRate).toBe(0.1);
    expect(config.debugMemory).toBe(true);
  });

  it('returns validation errors for out-of-range and inconsistent config', () => {
    process.env.RAG_TOKEN_BUDGET = '50';
    process.env.RAG_RERANK_ALPHA = '0.2';
    process.env.RAG_RERANK_BETA = '0.2';
    process.env.RAG_RERANK_GAMMA = '0.2';
    process.env.METRICS_RETENTION_DAYS = '0';
    process.env.RAG_METRICS_SAMPLE_RATE = '2';

    const errors = validateMemoryConfig(getMemoryConfig());

    expect(errors.some(e => e.includes('RAG_TOKEN_BUDGET'))).toBe(true);
    expect(errors.some(e => e.includes('Rerank coefficients'))).toBe(true);
    expect(errors.some(e => e.includes('METRICS_RETENTION_DAYS'))).toBe(true);
    expect(errors.some(e => e.includes('RAG_METRICS_SAMPLE_RATE'))).toBe(true);
  });

  it('normalizes runtime preferences with coercion and clamping', () => {
    const fallback: MemoryRuntimePreferences = {
      rag_hybrid: false,
      rag_chunking: true,
      rag_token_budget: 1000,
      rag_summary_frequency: 5,
    };

    const normalized = normalizeMemoryRuntimePreferences(
      {
        rag_hybrid: 'true' as unknown as boolean,
        rag_chunking: 0 as unknown as boolean,
        rag_token_budget: '99999' as unknown as number,
        rag_summary_frequency: -10 as unknown as number,
      },
      fallback
    );

    expect(normalized).toEqual({
      rag_hybrid: true,
      rag_chunking: false,
      rag_token_budget: 5000,
      rag_summary_frequency: 0,
    });
  });

  it('applies runtime preferences back into environment values', () => {
    applyMemoryRuntimePreferencesToEnv({
      rag_hybrid: true,
      rag_chunking: false,
      rag_token_budget: 1500,
      rag_summary_frequency: 12,
    });

    expect(process.env.RAG_HYBRID).toBe('true');
    expect(process.env.RAG_CHUNKING).toBe('false');
    expect(process.env.RAG_TOKEN_BUDGET).toBe('1500');
    expect(process.env.RAG_SUMMARY_FREQUENCY).toBe('12');

    const fromEnv = getMemoryRuntimePreferencesFromEnv();
    expect(fromEnv.rag_hybrid).toBe(true);
    expect(fromEnv.rag_chunking).toBe(false);
  });

  it('reads and persists runtime preferences with storage adapter', () => {
    const getPreference = vi
      .fn()
      .mockImplementation((key: string) => {
        if (key === 'memory_rag_hybrid') return { value: true };
        if (key === 'memory_rag_chunking') return { value: false };
        if (key === 'memory_rag_token_budget') return { value: 1200 };
        if (key === 'memory_rag_summary_frequency') return { value: 7 };
        return null;
      });

    const setPreference = vi.fn();
    const storage = { getPreference, setPreference } as unknown as SQLiteStorage;

    const read = readMemoryRuntimePreferencesFromStorage(storage);
    expect(read).toEqual({
      rag_hybrid: true,
      rag_chunking: false,
      rag_token_budget: 1200,
      rag_summary_frequency: 7,
    });

    persistMemoryRuntimePreferences(storage, {
      rag_hybrid: true,
      rag_chunking: true,
      rag_token_budget: 900,
      rag_summary_frequency: 3,
    });

    expect(setPreference).toHaveBeenCalledWith('memory_rag_hybrid', true, 'boolean');
    expect(setPreference).toHaveBeenCalledWith('memory_rag_chunking', true, 'boolean');
    expect(setPreference).toHaveBeenCalledWith('memory_rag_token_budget', 900, 'number');
    expect(setPreference).toHaveBeenCalledWith('memory_rag_summary_frequency', 3, 'number');
  });
});
