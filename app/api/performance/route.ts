import { NextRequest, NextResponse } from 'next/server';
import { initializeMemory } from '@/app/lib/memory';
import { getPerformanceSnapshot } from '@/app/lib/system/performance';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await initializeMemory();
    const { searchParams } = new URL(req.url);
    const hoursRaw = Number(searchParams.get('hours') || '24');
    const snapshot = await getPerformanceSnapshot(hoursRaw);
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

