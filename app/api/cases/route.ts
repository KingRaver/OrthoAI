import { NextRequest, NextResponse } from 'next/server';
import { getCaseManager } from '@/app/lib/cases';
import { initializeStorage } from '@/app/lib/memory';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const manager = getCaseManager();
  const cases = manager.listCases(limit, offset);

  return NextResponse.json({ cases });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  if (!body?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const manager = getCaseManager();
  const patientCase = manager.createCase({
    title: body.title,
    status: body.status,
    demographics: body.demographics,
    history: body.history,
    complaints: body.complaints,
    imaging: body.imaging,
    labs: body.labs,
    medications: body.medications,
    allergies: body.allergies,
    tags: body.tags
  });

  return NextResponse.json({ case: patientCase }, { status: 201 });
}
