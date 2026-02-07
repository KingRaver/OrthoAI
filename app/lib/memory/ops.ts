export type MemoryOpCategory =
  | 'summary'
  | 'embedding'
  | 'retrieval'
  | 'metrics'
  | 'profile'
  | 'storage';

export interface MemoryFailureRecord {
  id: string;
  category: MemoryOpCategory;
  source: string;
  message: string;
  timestamp: string;
}

type OpCounter = {
  success: number;
  failure: number;
};

const MAX_HISTORY = 100;
const failureHistory: MemoryFailureRecord[] = [];
const opCounters = new Map<MemoryOpCategory, OpCounter>();

function nextId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCounter(category: MemoryOpCategory): OpCounter {
  const existing = opCounters.get(category);
  if (existing) return existing;
  const created: OpCounter = { success: 0, failure: 0 };
  opCounters.set(category, created);
  return created;
}

export function recordMemorySuccess(category: MemoryOpCategory): void {
  const counter = getCounter(category);
  counter.success += 1;
}

export function recordMemoryFailure(
  category: MemoryOpCategory,
  source: string,
  error: unknown
): void {
  const counter = getCounter(category);
  counter.failure += 1;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Unknown error';

  failureHistory.push({
    id: nextId('memfail'),
    category,
    source,
    message,
    timestamp: new Date().toISOString(),
  });

  if (failureHistory.length > MAX_HISTORY) {
    failureHistory.splice(0, failureHistory.length - MAX_HISTORY);
  }
}

export function getMemoryOpsSnapshot(limit: number = 20): {
  timestamp: string;
  counters: Record<MemoryOpCategory, OpCounter>;
  recentFailures: MemoryFailureRecord[];
} {
  const counters = {
    summary: getCounter('summary'),
    embedding: getCounter('embedding'),
    retrieval: getCounter('retrieval'),
    metrics: getCounter('metrics'),
    profile: getCounter('profile'),
    storage: getCounter('storage'),
  };

  const sanitizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, limit)) : 20;
  const recentFailures = failureHistory.slice(-sanitizedLimit).reverse();

  return {
    timestamp: new Date().toISOString(),
    counters,
    recentFailures,
  };
}
