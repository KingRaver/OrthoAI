import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getClinicalKnowledgeBase } from '@/app/lib/knowledge/clinicalKnowledgeBase';
import type { EvidenceLevel } from '@/app/lib/knowledge/phase5Types';

export const runtime = 'nodejs';

function normalizeLevel(value: unknown): EvidenceLevel | undefined {
  if (typeof value !== 'string') return undefined;
  if (!/^level-[1-5]$/.test(value)) return undefined;
  return value as EvidenceLevel;
}

export async function GET(req: NextRequest) {
  await initializeStorage();
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const sourceKey = searchParams.get('sourceKey') || undefined;
  const includeRemote = searchParams.get('remote') === '1';
  const limit = Number.parseInt(searchParams.get('limit') || '8', 10);
  const minEvidenceLevel = normalizeLevel(searchParams.get('minLevel'));

  if (!query.trim()) {
    return NextResponse.json({ error: 'q query parameter is required' }, { status: 400 });
  }

  const manager = getClinicalKnowledgeBase();
  const results = await manager.searchEvidence(query, {
    limit,
    sourceKey,
    includeRemote,
    minEvidenceLevel,
  });

  return NextResponse.json({ results, count: results.length });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const manager = getClinicalKnowledgeBase();
  const results = await manager.searchEvidence(query, {
    limit: typeof body?.limit === 'number' ? body.limit : undefined,
    sourceKey: typeof body?.sourceKey === 'string' ? body.sourceKey : undefined,
    includeRemote: Boolean(body?.includeRemote),
    minEvidenceLevel: normalizeLevel(body?.minEvidenceLevel),
  });

  return NextResponse.json({ results, count: results.length });
}
