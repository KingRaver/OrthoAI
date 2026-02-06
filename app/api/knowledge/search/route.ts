import { NextRequest, NextResponse } from 'next/server';
import { getKnowledgeManager } from '@/app/lib/knowledge';
import { initializeStorage } from '@/app/lib/memory';

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  if (!body?.query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const manager = getKnowledgeManager();
  const results = await manager.search(body.query, {
    limit: body.limit,
    subspecialty: body.subspecialty,
    diagnosisTag: body.diagnosisTag,
    documentId: body.documentId
  });

  return NextResponse.json({ results });
}
