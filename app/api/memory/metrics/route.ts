// app/api/memory/metrics/route.ts
// API endpoint for retrieval metrics (Phase 1: Baseline Audit)

import { NextRequest, NextResponse } from 'next/server';
import { getMetricsSummary, getDailyMetrics, cleanupOldMetrics } from '@/app/lib/memory/metrics';
import { getMemoryConfig } from '@/app/lib/memory/config';

export const runtime = 'nodejs';

/**
 * GET /api/memory/metrics
 * Returns retrieval metrics summary
 *
 * Query params:
 * - days: number of days to include (default: 7)
 * - type: 'summary' | 'daily' | 'config' (default: 'summary')
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'summary';
    const days = parseInt(searchParams.get('days') || '7', 10);

    if (type === 'config') {
      // Return current memory configuration
      const config = getMemoryConfig();
      return NextResponse.json({ config });
    }

    if (type === 'daily') {
      // Return daily metrics for visualization
      const dailyMetrics = await getDailyMetrics(days);
      return NextResponse.json({
        type: 'daily',
        days,
        metrics: dailyMetrics
      });
    }

    // Default: return summary
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();

    const summary = await getMetricsSummary(startDate, endDate);

    return NextResponse.json({
      type: 'summary',
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
      },
      summary,
    });
  } catch (error) {
    console.error('[API] Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/memory/metrics/cleanup
 * Cleanup old metrics based on retention policy
 */
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (action === 'cleanup') {
      const deleted = await cleanupOldMetrics();
      return NextResponse.json({
        success: true,
        deletedCount: deleted,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: cleanup' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Error in metrics action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action', details: (error as Error).message },
      { status: 500 }
    );
  }
}
