import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getImagingManager } from '@/app/lib/imaging';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const imaging = getImagingManager();
  const { searchParams } = new URL(req.url);
  const studyId = searchParams.get('studyId');
  if (!studyId) {
    return NextResponse.json({ error: 'studyId is required' }, { status: 400 });
  }

  const comparisons = imaging.listComparisonsForStudy(studyId);
  return NextResponse.json({ comparisons });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  if (typeof body?.studyId1 !== 'string' || typeof body?.studyId2 !== 'string') {
    return NextResponse.json({ error: 'studyId1 and studyId2 are required' }, { status: 400 });
  }

  const imaging = getImagingManager();
  const comparison = imaging.createComparison(
    body.studyId1,
    body.studyId2,
    body.comparisonType,
    typeof body?.notes === 'string' ? body.notes : undefined
  );

  return NextResponse.json({ comparison }, { status: 201 });
}

