import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getCaseManager } from '@/app/lib/cases';
import { getClinicalLearningManager } from '@/app/lib/clinical/learning';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const caseManager = getCaseManager();
  const patientCase = caseManager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const learning = getClinicalLearningManager();

  return NextResponse.json({
    caseId: id,
    summary: learning.getCaseLearningSummary(id),
    corrections: learning.listCorrections(id, 20),
    experiments: learning.listExperiments(id, 20),
    crossCasePatterns: learning.getCrossCasePatterns(10),
    userPreferenceProfile: learning.getUserPreferenceProfile(),
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const caseManager = getCaseManager();
  const patientCase = caseManager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const body = await req.json();
  if (body?.action !== 'record_experiment') {
    return NextResponse.json(
      { error: 'Unsupported action. Use action=record_experiment' },
      { status: 400 }
    );
  }

  const variant = body?.strategyVariant;
  if (variant !== 'variant_a' && variant !== 'variant_b') {
    return NextResponse.json(
      { error: 'strategyVariant must be variant_a or variant_b' },
      { status: 400 }
    );
  }

  const learning = getClinicalLearningManager();
  const experiment = learning.addExperiment({
    caseId: id,
    strategyVariant: variant,
    responseQuality: typeof body?.responseQuality === 'number' ? body.responseQuality : undefined,
    userFeedback: body?.userFeedback,
  });

  return NextResponse.json({ experiment }, { status: 201 });
}

