import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: Params) {
  const { id } = await context.params;
  await initializeStorage();
  const body = await req.json();
  if (!body?.conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  const manager = getCaseManager();
  const link = manager.linkConversation(id, body.conversationId);

  return NextResponse.json({ link }, { status: 201 });
}
