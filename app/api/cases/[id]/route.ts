import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const manager = getCaseManager();
  const patientCase = manager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const events = manager.listEvents(id);
  const links = manager.listLinkedConversations(id);

  return NextResponse.json({ case: patientCase, events, conversations: links });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const updates = await req.json();
  const manager = getCaseManager();
  const patientCase = manager.updateCase(id, updates);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  return NextResponse.json({ case: patientCase });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const manager = getCaseManager();
  const deleted = manager.deleteCase(id);
  if (!deleted) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
