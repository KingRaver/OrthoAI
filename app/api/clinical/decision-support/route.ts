import { NextRequest, NextResponse } from 'next/server';
import {
  buildClinicalDecisionBundle,
  calculateKoos,
  calculateOdi,
  calculateWomac,
} from '@/app/lib/clinical/decisionSupport';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body?.action as string | undefined;

  if (action === 'bundle') {
    if (typeof body?.complaint !== 'string' || body.complaint.trim().length === 0) {
      return NextResponse.json({ error: 'complaint is required' }, { status: 400 });
    }

    const bundle = buildClinicalDecisionBundle({
      complaint: body.complaint,
      history: typeof body?.history === 'string' ? body.history : undefined,
      examFindings: Array.isArray(body?.examFindings)
        ? body.examFindings.filter((item: unknown): item is string => typeof item === 'string')
        : [],
      age: typeof body?.age === 'number' ? body.age : undefined,
      comorbidities: Array.isArray(body?.comorbidities)
        ? body.comorbidities.filter((item: unknown): item is string => typeof item === 'string')
        : [],
      activityGoal: typeof body?.activityGoal === 'string' ? body.activityGoal : undefined,
      procedure: typeof body?.procedure === 'string' ? body.procedure : undefined,
      daysSinceInjury: typeof body?.daysSinceInjury === 'number' ? body.daysSinceInjury : undefined,
    });

    return NextResponse.json({ bundle });
  }

  if (action === 'calc_womac') {
    if (!Array.isArray(body?.values)) {
      return NextResponse.json({ error: 'values array is required' }, { status: 400 });
    }
    const numeric = body.values.filter((item: unknown): item is number => typeof item === 'number');
    return NextResponse.json({ womac: calculateWomac(numeric) });
  }

  if (action === 'calc_koos') {
    const fields = ['pain', 'symptoms', 'adl', 'sport', 'qol'] as const;
    const missing = fields.filter(field => typeof body?.[field] !== 'number');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing numeric fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }
    return NextResponse.json({
      koos: calculateKoos({
        pain: body.pain,
        symptoms: body.symptoms,
        adl: body.adl,
        sport: body.sport,
        qol: body.qol,
      }),
    });
  }

  if (action === 'calc_odi') {
    if (!Array.isArray(body?.values)) {
      return NextResponse.json({ error: 'values array is required' }, { status: 400 });
    }
    const numeric = body.values.filter((item: unknown): item is number => typeof item === 'number');
    return NextResponse.json({ odi: calculateOdi(numeric) });
  }

  return NextResponse.json(
    { error: 'Unsupported action. Use bundle, calc_womac, calc_koos, or calc_odi.' },
    { status: 400 }
  );
}

