import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  await initializeStorage();
  const manager = getCaseManager();
  const summary = manager.exportSummary(params.id);
  if (!summary) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  return new NextResponse(summary, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="case_${params.id}.txt"`
    }
  });
}
