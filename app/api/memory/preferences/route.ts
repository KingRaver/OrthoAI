import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager, getStorage } from '@/app/lib/memory';
import {
  applyMemoryRuntimePreferencesToEnv,
  getMemoryRuntimePreferencesFromEnv,
  normalizeMemoryRuntimePreferences,
  persistMemoryRuntimePreferences,
  readMemoryRuntimePreferencesFromStorage,
} from '@/app/lib/memory/preferences';

export const runtime = 'nodejs';

export async function GET() {
  const memory = getMemoryManager();
  await memory.initialize();
  const storage = getStorage();

  const fromStorage = readMemoryRuntimePreferencesFromStorage(storage);
  const current = normalizeMemoryRuntimePreferences(
    fromStorage,
    getMemoryRuntimePreferencesFromEnv()
  );

  return NextResponse.json({ preferences: current });
}

export async function POST(req: NextRequest) {
  const memory = getMemoryManager();
  await memory.initialize();
  const storage = getStorage();

  const body = await req.json().catch(() => ({}));
  const updates = body?.preferences && typeof body.preferences === 'object'
    ? body.preferences
    : body;

  const fromStorage = readMemoryRuntimePreferencesFromStorage(storage);
  const baseline = normalizeMemoryRuntimePreferences(
    fromStorage,
    getMemoryRuntimePreferencesFromEnv()
  );
  const next = normalizeMemoryRuntimePreferences(
    { ...baseline, ...updates },
    baseline
  );

  persistMemoryRuntimePreferences(storage, next);
  applyMemoryRuntimePreferencesToEnv(next);

  return NextResponse.json({ preferences: next });
}
