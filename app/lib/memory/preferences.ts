import { getMemoryConfig } from './config';
import { SQLiteStorage } from './storage/sqlite';

export interface MemoryRuntimePreferences {
  rag_hybrid: boolean;
  rag_chunking: boolean;
  rag_token_budget: number;
  rag_summary_frequency: number;
}

const STORAGE_KEYS = {
  rag_hybrid: 'memory_rag_hybrid',
  rag_chunking: 'memory_rag_chunking',
  rag_token_budget: 'memory_rag_token_budget',
  rag_summary_frequency: 'memory_rag_summary_frequency',
} as const;

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return fallback;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getMemoryRuntimePreferencesFromEnv(): MemoryRuntimePreferences {
  const config = getMemoryConfig();
  return {
    rag_hybrid: config.ragHybrid,
    rag_chunking: config.ragChunking,
    rag_token_budget: config.ragTokenBudget,
    rag_summary_frequency: config.ragSummaryFrequency,
  };
}

export function normalizeMemoryRuntimePreferences(
  input: Partial<MemoryRuntimePreferences>,
  fallback: MemoryRuntimePreferences = getMemoryRuntimePreferencesFromEnv()
): MemoryRuntimePreferences {
  return {
    rag_hybrid: toBoolean(input.rag_hybrid, fallback.rag_hybrid),
    rag_chunking: toBoolean(input.rag_chunking, fallback.rag_chunking),
    rag_token_budget: clamp(
      Math.round(toNumber(input.rag_token_budget, fallback.rag_token_budget)),
      100,
      5000
    ),
    rag_summary_frequency: clamp(
      Math.round(toNumber(input.rag_summary_frequency, fallback.rag_summary_frequency)),
      0,
      100
    ),
  };
}

export function applyMemoryRuntimePreferencesToEnv(
  preferences: MemoryRuntimePreferences
): void {
  process.env.RAG_HYBRID = String(preferences.rag_hybrid);
  process.env.RAG_CHUNKING = String(preferences.rag_chunking);
  process.env.RAG_TOKEN_BUDGET = String(preferences.rag_token_budget);
  process.env.RAG_SUMMARY_FREQUENCY = String(preferences.rag_summary_frequency);
}

export function readMemoryRuntimePreferencesFromStorage(
  storage: SQLiteStorage
): Partial<MemoryRuntimePreferences> {
  const ragHybrid = storage.getPreference(STORAGE_KEYS.rag_hybrid);
  const ragChunking = storage.getPreference(STORAGE_KEYS.rag_chunking);
  const ragTokenBudget = storage.getPreference(STORAGE_KEYS.rag_token_budget);
  const ragSummaryFrequency = storage.getPreference(STORAGE_KEYS.rag_summary_frequency);

  const result: Partial<MemoryRuntimePreferences> = {};
  if (ragHybrid) result.rag_hybrid = ragHybrid.value as unknown as boolean;
  if (ragChunking) result.rag_chunking = ragChunking.value as unknown as boolean;
  if (ragTokenBudget) result.rag_token_budget = ragTokenBudget.value as unknown as number;
  if (ragSummaryFrequency) {
    result.rag_summary_frequency = ragSummaryFrequency.value as unknown as number;
  }
  return result;
}

export function persistMemoryRuntimePreferences(
  storage: SQLiteStorage,
  preferences: MemoryRuntimePreferences
): void {
  storage.setPreference(STORAGE_KEYS.rag_hybrid, preferences.rag_hybrid, 'boolean');
  storage.setPreference(STORAGE_KEYS.rag_chunking, preferences.rag_chunking, 'boolean');
  storage.setPreference(STORAGE_KEYS.rag_token_budget, preferences.rag_token_budget, 'number');
  storage.setPreference(
    STORAGE_KEYS.rag_summary_frequency,
    preferences.rag_summary_frequency,
    'number'
  );
}
