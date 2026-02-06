// app/api/dl-codegen/predict/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'DL codegen is disabled in OrthoAI' },
    { status: 410 }
  );
}
