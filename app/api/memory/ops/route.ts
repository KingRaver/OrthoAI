import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '@/app/lib/memory';
import { getMemoryOpsSnapshot } from '@/app/lib/memory/ops';
import { getMemoryConfig } from '@/app/lib/memory/config';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 20;

    const memory = getMemoryManager();
    await memory.initialize();

    const config = getMemoryConfig();
    const queueDepth = memory.getQueueDepths();
    const ops = getMemoryOpsSnapshot(limit);
    const summary = memory.getSummaryOperationalSnapshot(limit);

    return NextResponse.json({
      timestamp: ops.timestamp,
      queueDepth,
      counters: ops.counters,
      recentFailures: ops.recentFailures,
      summary,
      controls: {
        retrievalMetricsEnabled: config.retrievalMetricsEnabled,
        retrievalMetricsSampleRate: config.retrievalMetricsSampleRate,
        searchQueryLoggingEnabled: config.searchQueryLoggingEnabled,
        searchQueryLoggingSampleRate: config.searchQueryLoggingSampleRate,
        summaryRequestTimeoutMs: config.summaryRequestTimeoutMs,
        summaryRequestRetries: config.summaryRequestRetries,
        summaryQueueMaxDepth: config.summaryQueueMaxDepth,
        summaryJobMaxAttempts: config.summaryJobMaxAttempts,
        summaryRetryBaseDelayMs: config.summaryRetryBaseDelayMs,
        summaryCircuitBreakerFailureThreshold: config.summaryCircuitBreakerFailureThreshold,
        summaryCircuitBreakerCooldownMs: config.summaryCircuitBreakerCooldownMs,
        embeddingRequestTimeoutMs: config.embeddingRequestTimeoutMs,
        embeddingRequestRetries: config.embeddingRequestRetries,
      },
    });
  } catch (error) {
    console.error('[API /memory/ops GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memory ops snapshot' },
      { status: 500 }
    );
  }
}
