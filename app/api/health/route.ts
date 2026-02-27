import { NextResponse } from 'next/server';
import { getSystemHealthSnapshot } from '@/app/lib/system/health';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const snapshot = await getSystemHealthSnapshot();
    const statusCode = snapshot.status === 'down' ? 503 : 200;
    return NextResponse.json(snapshot, { status: statusCode });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'down',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 503 }
    );
  }
}

