import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getCaseManager } from '@/app/lib/cases';
import { getClinicalLearningManager } from '@/app/lib/clinical/learning';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const caseManager = getCaseManager();
  if (!caseManager.getCase(id)) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get('limit') || '50');
  const learning = getClinicalLearningManager();
  const corrections = learning.listCorrections(id, limit);
  return NextResponse.json({ corrections });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const caseManager = getCaseManager();
  if (!caseManager.getCase(id)) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const body = await req.json();
  if (typeof body?.sourceMessage !== 'string' || typeof body?.correctedRecommendation !== 'string') {
    return NextResponse.json(
      { error: 'sourceMessage and correctedRecommendation are required' },
      { status: 400 }
    );
  }

  const learning = getClinicalLearningManager();
  const correction = learning.addCorrection({
    caseId: id,
    sourceMessage: body.sourceMessage,
    correctedRecommendation: body.correctedRecommendation,
    subspecialty: typeof body?.subspecialty === 'string' ? body.subspecialty : null,
    diagnosisTag: typeof body?.diagnosisTag === 'string' ? body.diagnosisTag : null,
  });

  return NextResponse.json({ correction }, { status: 201 });
}

