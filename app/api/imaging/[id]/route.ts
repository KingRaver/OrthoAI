import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getImagingManager } from '@/app/lib/imaging';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const imaging = getImagingManager();
  const study = imaging.getStudy(id);
  if (!study) {
    return NextResponse.json({ error: 'study not found' }, { status: 404 });
  }
  return NextResponse.json({ study });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const body = await req.json();
  const imaging = getImagingManager();
  const study = imaging.updateStudy(id, {
    case_id: typeof body?.case_id === 'string' ? body.case_id : body?.case_id ?? undefined,
    study_type: typeof body?.study_type === 'string' ? body.study_type : undefined,
    modality: typeof body?.modality === 'string' ? body.modality : body?.modality ?? undefined,
    body_part: typeof body?.body_part === 'string' ? body.body_part : body?.body_part ?? undefined,
    laterality: body?.laterality,
    study_date: typeof body?.study_date === 'string' ? body.study_date : body?.study_date ?? undefined,
    description: typeof body?.description === 'string' ? body.description : body?.description ?? undefined,
    file_path: typeof body?.file_path === 'string' ? body.file_path : body?.file_path ?? undefined,
    dicom_metadata: typeof body?.dicom_metadata === 'object' ? body.dicom_metadata : body?.dicom_metadata ?? undefined,
    findings: typeof body?.findings === 'string' ? body.findings : body?.findings ?? undefined,
    impression: typeof body?.impression === 'string' ? body.impression : body?.impression ?? undefined,
  });

  if (!study) {
    return NextResponse.json({ error: 'study not found' }, { status: 404 });
  }
  return NextResponse.json({ study });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const imaging = getImagingManager();
  const deleted = imaging.deleteStudy(id);
  if (!deleted) {
    return NextResponse.json({ error: 'study not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

