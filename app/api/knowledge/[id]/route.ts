import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeManager } from '@/app/lib/knowledge';
import { initializeStorage } from '@/app/lib/memory';

interface Params {
  params: { id: string };
}

export async function GET(_req: NextRequest, { params }: Params) {
  await initializeStorage();
  const manager = getKnowledgeManager();
  const document = manager.getDocument(params.id);
  if (!document) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 });
  }
  const chunks = manager.listChunks(params.id);
  return NextResponse.json({ document, chunks });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  await initializeStorage();
  const manager = getKnowledgeManager();
  const deleted = manager.deleteDocument(params.id);
  if (!deleted) {
    return NextResponse.json({ error: 'document not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
