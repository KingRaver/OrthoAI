import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  await initializeStorage();
  const manager = getCaseManager();
  const events = manager.listEvents(params.id);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest, { params }: Params) {
  await initializeStorage();
  const body = await req.json();
  if (!body?.event_type) {
    return NextResponse.json({ error: 'event_type is required' }, { status: 400 });
  }

  const manager = getCaseManager();
  const event = manager.addEvent(params.id, {
    event_type: body.event_type,
    summary: body.summary,
    details: body.details,
    occurred_at: body.occurred_at
  });

  return NextResponse.json({ event }, { status: 201 });
}
