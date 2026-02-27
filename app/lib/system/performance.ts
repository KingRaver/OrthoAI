import os from 'os';
import { getStorage } from '@/app/lib/memory';

type Percentiles = {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
};

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const rank = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sortedValues[lower];
  const weight = rank - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function buildPercentiles(values: number[]): Percentiles {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: Math.round(percentile(sorted, 50)),
    p90: Math.round(percentile(sorted, 90)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
  };
}

export async function getPerformanceSnapshot(hours: number): Promise<{
  windowHours: number;
  generatedAt: string;
  llmLatencyMs: Percentiles;
  retrievalLatencyMs: Percentiles;
  throughputPerHour: Array<{ hour: string; requests: number; messages: number }>;
  process: {
    rssMb: number;
    heapUsedMb: number;
    loadAvg1m: number;
    cpuCount: number;
    uptimeSec: number;
  };
}> {
  const storage = getStorage();
  const db = storage.getDatabase();
  const normalizedHours = Math.max(1, Math.min(168, hours));
  const sinceIso = new Date(Date.now() - normalizedHours * 60 * 60 * 1000).toISOString();

  const llmRows = db.prepare(`
    SELECT response_time_ms as value
    FROM strategy_outcomes
    WHERE created_at >= ? AND response_time_ms IS NOT NULL
  `).all(sinceIso) as Array<{ value: number }>;

  const retrievalRows = db.prepare(`
    SELECT latency_total_ms as value
    FROM retrieval_metrics
    WHERE created_at >= ?
  `).all(sinceIso) as Array<{ value: number }>;

  const throughputRows = db.prepare(`
    WITH message_counts AS (
      SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) AS hour_bucket,
             COUNT(*) AS message_count
      FROM messages
      WHERE created_at >= ?
      GROUP BY hour_bucket
    ),
    request_counts AS (
      SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) AS hour_bucket,
             COUNT(*) AS request_count
      FROM strategy_outcomes
      WHERE created_at >= ?
      GROUP BY hour_bucket
    ),
    combined AS (
      SELECT m.hour_bucket AS hour_bucket,
             COALESCE(r.request_count, 0) AS request_count,
             m.message_count AS message_count
      FROM message_counts m
      LEFT JOIN request_counts r
        ON m.hour_bucket = r.hour_bucket
      UNION ALL
      SELECT r.hour_bucket AS hour_bucket,
             r.request_count AS request_count,
             0 AS message_count
      FROM request_counts r
      LEFT JOIN message_counts m
        ON r.hour_bucket = m.hour_bucket
      WHERE m.hour_bucket IS NULL
    )
    SELECT hour_bucket,
           SUM(request_count) AS request_count,
           SUM(message_count) AS message_count
    FROM combined
    GROUP BY hour_bucket
    ORDER BY hour_bucket ASC
  `).all(sinceIso, sinceIso) as Array<{
    hour_bucket: string;
    request_count: number;
    message_count: number;
  }>;

  const processMemory = process.memoryUsage();
  return {
    windowHours: normalizedHours,
    generatedAt: new Date().toISOString(),
    llmLatencyMs: buildPercentiles(llmRows.map(row => row.value).filter(value => Number.isFinite(value))),
    retrievalLatencyMs: buildPercentiles(
      retrievalRows.map(row => row.value).filter(value => Number.isFinite(value))
    ),
    throughputPerHour: throughputRows.map(row => ({
      hour: row.hour_bucket,
      requests: row.request_count,
      messages: row.message_count,
    })),
    process: {
      rssMb: Math.round(processMemory.rss / 1024 / 1024),
      heapUsedMb: Math.round(processMemory.heapUsed / 1024 / 1024),
      loadAvg1m: os.loadavg()[0] || 0,
      cpuCount: os.cpus().length,
      uptimeSec: process.uptime(),
    },
  };
}
