import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getImagingManager } from '@/app/lib/imaging';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const imaging = getImagingManager();
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || undefined;
  const modality = searchParams.get('modality') || undefined;
  const bodyPart = searchParams.get('bodyPart') || undefined;

  const templates = imaging.listTemplates({
    category,
    modality,
    body_part: bodyPart,
  });

  return NextResponse.json({ templates });
}

