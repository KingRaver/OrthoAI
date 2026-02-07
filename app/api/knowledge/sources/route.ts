import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getClinicalKnowledgeBase } from '@/app/lib/knowledge/clinicalKnowledgeBase';
import type { KnowledgeSourceCategory } from '@/app/lib/knowledge/phase5Types';

export const runtime = 'nodejs';

function parseCategory(value: string | null): KnowledgeSourceCategory | undefined {
  if (!value) return undefined;
  if (value === 'guideline' || value === 'evidence' || value === 'reference') {
    return value;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  await initializeStorage();
  const category = parseCategory(req.nextUrl.searchParams.get('category'));
  const manager = getClinicalKnowledgeBase();
  const sources = manager.listSources(category);
  return NextResponse.json({ sources, count: sources.length });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  const sourceKey = typeof body?.sourceKey === 'string' ? body.sourceKey : '';
  if (!sourceKey) {
    return NextResponse.json({ error: 'sourceKey is required' }, { status: 400 });
  }
  if (typeof body?.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled boolean is required' }, { status: 400 });
  }

  const manager = getClinicalKnowledgeBase();
  const source = manager.setSourceEnabled(sourceKey, body.enabled);
  if (!source) {
    return NextResponse.json({ error: 'source not found' }, { status: 404 });
  }

  return NextResponse.json({ source });
}
