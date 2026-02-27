import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';
import {
  buildCaseDashboard,
  buildClinicalDecisionBundle,
} from '@/app/lib/clinical/decisionSupport';

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseAge(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const manager = getCaseManager();
  const patientCase = manager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const events = manager.listEvents(id);
  const { searchParams } = new URL(req.url);
  const complaintOverride = searchParams.get('complaint');
  const historyOverride = searchParams.get('history');

  const demographics = patientCase.demographics as Record<string, unknown> | null;
  const bundle = buildClinicalDecisionBundle({
    complaint: complaintOverride || patientCase.complaints || patientCase.title,
    history: historyOverride || patientCase.history || undefined,
    examFindings: [],
    age: parseAge(demographics?.age),
    comorbidities: toStringArray(demographics?.comorbidities),
    activityGoal: typeof demographics?.activityGoal === 'string' ? demographics.activityGoal : undefined,
  });

  return NextResponse.json({
    caseId: id,
    bundle,
    dashboard: buildCaseDashboard(patientCase, events),
  });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();

  const manager = getCaseManager();
  const patientCase = manager.getCase(id);
  if (!patientCase) {
    return NextResponse.json({ error: 'case not found' }, { status: 404 });
  }

  const body = await req.json();
  const events = manager.listEvents(id);
  const demographics = patientCase.demographics as Record<string, unknown> | null;

  const bundle = buildClinicalDecisionBundle({
    complaint: typeof body?.complaint === 'string' ? body.complaint : (patientCase.complaints || patientCase.title),
    history: typeof body?.history === 'string' ? body.history : (patientCase.history || undefined),
    examFindings: Array.isArray(body?.examFindings)
      ? body.examFindings.filter((item: unknown): item is string => typeof item === 'string')
      : [],
    age: parseAge(body?.age ?? demographics?.age),
    comorbidities: Array.isArray(body?.comorbidities)
      ? body.comorbidities.filter((item: unknown): item is string => typeof item === 'string')
      : toStringArray(demographics?.comorbidities),
    activityGoal: typeof body?.activityGoal === 'string'
      ? body.activityGoal
      : (typeof demographics?.activityGoal === 'string' ? demographics.activityGoal : undefined),
    procedure: typeof body?.procedure === 'string' ? body.procedure : undefined,
    daysSinceInjury: typeof body?.daysSinceInjury === 'number' ? body.daysSinceInjury : undefined,
  });

  return NextResponse.json({
    caseId: id,
    bundle,
    dashboard: buildCaseDashboard(patientCase, events),
  });
}

