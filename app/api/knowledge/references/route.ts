import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getClinicalKnowledgeBase } from '@/app/lib/knowledge/clinicalKnowledgeBase';
import type { ClinicalReferenceCategory } from '@/app/lib/knowledge/phase5Types';

export const runtime = 'nodejs';

function parseCategory(value: string | null): ClinicalReferenceCategory | undefined {
  if (!value) return undefined;
  if (
    value === 'implant' ||
    value === 'medication_protocol' ||
    value === 'injection_technique' ||
    value === 'dme_bracing'
  ) {
    return value;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  await initializeStorage();
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const category = parseCategory(searchParams.get('category'));
  const limit = Number.parseInt(searchParams.get('limit') || '10', 10);

  const manager = getClinicalKnowledgeBase();
  const results = manager.searchReferenceItems(query, { category, limit });
  return NextResponse.json({ results, count: results.length });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  const manager = getClinicalKnowledgeBase();

  if (body?.seedDefaults) {
    const summary = manager.seedReferenceItems(Boolean(body.force));
    return NextResponse.json({ summary });
  }

  if (!Array.isArray(body?.items) || body.items.length === 0) {
    return NextResponse.json(
      { error: 'Provide items array or seedDefaults=true' },
      { status: 400 }
    );
  }

  const validItems = body.items.filter((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.category === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.summary === 'string'
    );
  }) as Array<Record<string, unknown>>;

  if (validItems.length === 0) {
    return NextResponse.json({ error: 'No valid items provided' }, { status: 400 });
  }

  const affected = manager.upsertReferenceItems(
    validItems.map(item => ({
      category: item.category as ClinicalReferenceCategory,
      name: item.name as string,
      summary: item.summary as string,
      indications: typeof item.indications === 'string' ? item.indications : null,
      contraindications: typeof item.contraindications === 'string' ? item.contraindications : null,
      metadata_json: item.metadata_json && typeof item.metadata_json === 'object'
        ? item.metadata_json as Record<string, unknown>
        : null,
      source: typeof item.source === 'string' ? item.source : null,
      version: typeof item.version === 'string' ? item.version : null,
    }))
  );

  return NextResponse.json({ affected });
}
