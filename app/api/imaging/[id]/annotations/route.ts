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
  const annotations = imaging.listAnnotations(id);
  return NextResponse.json({ annotations });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const body = await req.json();
  const imaging = getImagingManager();
  const study = imaging.getStudy(id);
  if (!study) {
    return NextResponse.json({ error: 'study not found' }, { status: 404 });
  }

  if (typeof body?.annotation_type !== 'string') {
    return NextResponse.json({ error: 'annotation_type is required' }, { status: 400 });
  }
  if (typeof body?.data !== 'object' || body.data === null) {
    return NextResponse.json({ error: 'annotation data is required' }, { status: 400 });
  }

  const annotation = imaging.createAnnotation({
    study_id: id,
    annotation_type: body.annotation_type,
    label: typeof body?.label === 'string' ? body.label : null,
    data: body.data,
  });

  return NextResponse.json({ annotation }, { status: 201 });
}

