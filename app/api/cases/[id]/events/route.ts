import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: Params) {
  const { id } = await context.params;
  await initializeStorage();
  const manager = getCaseManager();
  const events = manager.listEvents(id);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest, context: Params) {
  const { id } = await context.params;
  await initializeStorage();
  const body = await req.json();
  if (!body?.event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const manager = getCaseManager();
  const event = manager.addEvent(id, {
    event_type: body.event_type,
    summary: body.summary,
    details: body.details,
    occurred_at: body.occurred_at
  });

  return NextResponse.json({ event }, { status: 201 });
}
