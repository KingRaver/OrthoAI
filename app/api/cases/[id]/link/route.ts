import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: { id: string };
}

export async function POST(req: NextRequest, { params }: Params) {
  await initializeStorage();
  const body = await req.json();
  if (!body?.conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
  }

  const manager = getCaseManager();
  const link = manager.linkConversation(params.id, body.conversationId);

  return NextResponse.json({ link }, { status: 201 });
}
