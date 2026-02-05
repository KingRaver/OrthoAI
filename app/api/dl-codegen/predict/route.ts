// app/api/dl-codegen/predict/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'DL codegen is disabled in OrthoAI' },
    { status: 410 }
  );
}
