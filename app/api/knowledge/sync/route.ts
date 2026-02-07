import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getClinicalKnowledgeBase } from '@/app/lib/knowledge/clinicalKnowledgeBase';
import type { KnowledgeSyncJobType } from '@/app/lib/knowledge/phase5Types';

export const runtime = 'nodejs';

function parseJobType(value: unknown): KnowledgeSyncJobType | null {
  if (value === 'guideline_seed' || value === 'evidence_sync' || value === 'cleanup') {
    return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  await initializeStorage();
  const limit = Number.parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
  const manager = getClinicalKnowledgeBase();
  const jobs = manager.listSyncJobs(limit);
  const policy = manager.getStoragePolicy();
  return NextResponse.json({ jobs, policy, count: jobs.length });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const body = await req.json();
  const action = typeof body?.action === 'string' ? body.action : 'enqueue';
  const manager = getClinicalKnowledgeBase();

  if (action === 'processNext') {
    const result = await manager.processNextSyncJob();
    return NextResponse.json(result);
  }

  if (action === 'seedPhase5') {
    const guidelineSummary = await manager.seedGuidelineTemplates(Boolean(body?.force));
    const referenceSummary = manager.seedReferenceItems(Boolean(body?.force));
    return NextResponse.json({ guidelineSummary, referenceSummary });
  }

  if (action === 'syncEvidence') {
    const sourceKey = typeof body?.sourceKey === 'string' ? body.sourceKey : 'pubmed';
    const query = typeof body?.query === 'string' && body.query.trim()
      ? body.query.trim()
      : 'orthopedic treatment outcomes';
    const maxResults = typeof body?.maxResults === 'number' ? body.maxResults : undefined;
    const sync = await manager.syncEvidence({
      sourceKey,
      query,
      maxResults,
      sinceDate: typeof body?.sinceDate === 'string' ? body.sinceDate : undefined,
    });
    return NextResponse.json({ sync });
  }

  if (action === 'cleanup') {
    const cleanup = await manager.enforceStoragePolicy();
    return NextResponse.json({ cleanup });
  }

  if (action === 'updatePolicy') {
    const policy = manager.updateStoragePolicy({
      max_chunk_characters: typeof body?.max_chunk_characters === 'number'
        ? body.max_chunk_characters
        : undefined,
      max_evidence_records: typeof body?.max_evidence_records === 'number'
        ? body.max_evidence_records
        : undefined,
      retention_days: typeof body?.retention_days === 'number'
        ? body.retention_days
        : undefined,
    });
    return NextResponse.json({ policy });
  }

  const jobType = parseJobType(body?.jobType);
  if (!jobType) {
    return NextResponse.json(
      { error: 'Invalid action or jobType. Use jobType: guideline_seed|evidence_sync|cleanup' },
      { status: 400 }
    );
  }

  const job = manager.enqueueSyncJob({
    jobType,
    sourceKey: typeof body?.sourceKey === 'string' ? body.sourceKey : null,
    payload: body?.payload && typeof body.payload === 'object'
      ? body.payload as Record<string, unknown>
      : undefined,
    scheduledAt: typeof body?.scheduledAt === 'string' ? body.scheduledAt : undefined,
  });

  return NextResponse.json({ job }, { status: 201 });
}
