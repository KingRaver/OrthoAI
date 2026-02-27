import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getImagingManager } from '@/app/lib/imaging';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const body = await req.json();
  const imaging = getImagingManager();
  const annotation = imaging.updateAnnotation(id, {
    annotation_type: typeof body?.annotation_type === 'string' ? body.annotation_type : undefined,
    label: typeof body?.label === 'string' ? body.label : body?.label ?? undefined,
    data: typeof body?.data === 'object' ? body.data : body?.data ?? undefined,
  });

  if (!annotation) {
    return NextResponse.json({ error: 'annotation not found' }, { status: 404 });
  }
  return NextResponse.json({ annotation });
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  await initializeStorage();
  const imaging = getImagingManager();
  const deleted = imaging.deleteAnnotation(id);
  if (!deleted) {
    return NextResponse.json({ error: 'annotation not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

