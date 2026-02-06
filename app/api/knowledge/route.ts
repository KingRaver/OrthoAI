import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeManager } from '@/app/lib/knowledge';
import { initializeStorage } from '@/app/lib/memory';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const manager = getKnowledgeManager();
  const documents = manager.listDocuments(limit, offset);

  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  if (!body?.title || !body?.content) {
    return NextResponse.json({ error: 'title and content are required' }, { status: 400 });
  }

  const manager = getKnowledgeManager();
  const document = await manager.ingestDocument({
    title: body.title,
    content: body.content,
    source: body.source,
    version: body.version,
    subspecialty: body.subspecialty,
    diagnosisTags: body.diagnosisTags,
    contentType: body.contentType,
    publishedAt: body.publishedAt
  });

  return NextResponse.json({ document }, { status: 201 });
}
