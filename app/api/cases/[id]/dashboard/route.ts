import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getCaseManager } from '@/app/lib/cases';
import { buildCaseDashboard } from '@/app/lib/clinical/decisionSupport';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const manager = getCaseManager();
  const patientCase = manager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const events = manager.listEvents(id);
  const dashboard = buildCaseDashboard(patientCase, events);
  return NextResponse.json({ dashboard });
}

