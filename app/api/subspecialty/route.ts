import { NextRequest, NextResponse } from 'next/server';
import { initializeStorage } from '@/app/lib/memory';
import { getSubspecialtyManager } from '@/app/lib/clinical/subspecialty';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  await initializeStorage();
  const manager = getSubspecialtyManager();
  const { searchParams } = new URL(req.url);
  const subspecialty = searchParams.get('subspecialty') || 'general';

  return NextResponse.json({
    subspecialty,
    benchmark: manager.getBenchmarkSummary(subspecialty),
    models: manager.listModelVersions(subspecialty),
    weights: manager.getWeights(subspecialty),
  });
}

export async function POST(req: NextRequest) {
  await initializeStorage();
  const manager = getSubspecialtyManager();
  const body = await req.json();
  const action = body?.action as string | undefined;

  if (!action) {
    return NextResponse.json({ error: 'action is required' }, { status: 400 });
  }

  if (action === 'add_model_version') {
    if (typeof body?.subspecialty !== 'string' || typeof body?.modelName !== 'string' || typeof body?.modelVersion !== 'string') {
      return NextResponse.json(
        { error: 'subspecialty, modelName, and modelVersion are required' },
        { status: 400 }
      );
    }

    const model = manager.addModelVersion({
      subspecialty: body.subspecialty,
      modelName: body.modelName,
      modelVersion: body.modelVersion,
      endpoint: typeof body?.endpoint === 'string' ? body.endpoint : null,
      isActive: body?.isActive !== false,
    });
    return NextResponse.json({ model }, { status: 201 });
  }

  if (action === 'activate_model') {
    if (typeof body?.id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const model = manager.activateModelVersion(body.id);
    if (!model) {
      return NextResponse.json({ error: 'model version not found' }, { status: 404 });
    }
    return NextResponse.json({ model });
  }

  if (action === 'rollback_model') {
    if (typeof body?.subspecialty !== 'string' || typeof body?.modelName !== 'string') {
      return NextResponse.json({ error: 'subspecialty and modelName are required' }, { status: 400 });
    }
    const model = manager.rollbackModel(body.subspecialty, body.modelName);
    if (!model) {
      return NextResponse.json({ error: 'no prior model version available for rollback' }, { status: 404 });
    }
    return NextResponse.json({ model });
  }

  if (action === 'set_weights') {
    if (typeof body?.subspecialty !== 'string' || typeof body?.biomistralWeight !== 'number' || typeof body?.meditronWeight !== 'number') {
      return NextResponse.json(
        { error: 'subspecialty, biomistralWeight, and meditronWeight are required' },
        { status: 400 }
      );
    }
    const weights = manager.setWeights(body.subspecialty, body.biomistralWeight, body.meditronWeight);
    return NextResponse.json({ weights });
  }

  if (action === 'optimize_weights') {
    if (typeof body?.subspecialty !== 'string') {
      return NextResponse.json({ error: 'subspecialty is required' }, { status: 400 });
    }
    const weights = manager.optimizeWeightsFromFeedback(body.subspecialty);
    return NextResponse.json({ weights });
  }

  return NextResponse.json(
    { error: 'Unsupported action' },
    { status: 400 }
  );
}

