import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getImagingManager } from '@/app/lib/imaging';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const imaging = getImagingManager();
  const { searchParams } = new URL(req.url);

  const studies = imaging.listStudies({
    case_id: searchParams.get('caseId') || undefined,
    study_type: searchParams.get('studyType') || undefined,
    modality: searchParams.get('modality') || undefined,
    body_part: searchParams.get('bodyPart') || undefined,
    limit: Number(searchParams.get('limit') || '100'),
  });

  return NextResponse.json({ studies });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  if (typeof body?.study_type !== 'string' || body.study_type.trim().length === 0) {
    return NextResponse.json({ error: 'study_type is required' }, { status: 400 });
  }

  const imaging = getImagingManager();
  const study = imaging.createStudy({
    case_id: typeof body?.case_id === 'string' ? body.case_id : null,
    study_type: body.study_type,
    modality: typeof body?.modality === 'string' ? body.modality : null,
    body_part: typeof body?.body_part === 'string' ? body.body_part : null,
    laterality: body?.laterality ?? null,
    study_date: typeof body?.study_date === 'string' ? body.study_date : null,
    description: typeof body?.description === 'string' ? body.description : null,
    file_path: typeof body?.file_path === 'string' ? body.file_path : null,
    dicom_metadata: typeof body?.dicom_metadata === 'object' ? body.dicom_metadata : null,
    findings: typeof body?.findings === 'string' ? body.findings : null,
    impression: typeof body?.impression === 'string' ? body.impression : null,
  });

  return NextResponse.json({ study }, { status: 201 });
}

