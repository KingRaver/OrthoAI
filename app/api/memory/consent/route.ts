import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '@/app/lib/memory';

export const runtime = 'nodejs';

export async function GET() {
  const memory = getMemoryManager();
  await memory.initialize();

  return NextResponse.json({ consent: memory.isProfileConsentGranted() });
}

export async function POST(req: NextRequest) {
  const memory = getMemoryManager();
  await memory.initialize();

  const { consent } = await req.json();
  const consentValue = Boolean(consent);
  await memory.updateProfileConsent(consentValue);

  return NextResponse.json({ consent: consentValue });
}
