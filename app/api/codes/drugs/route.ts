import { NextRequest, NextResponse } from 'next/server';
import { getCodeLookupManager } from '@/app/lib/codes';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    const drugClass = searchParams.get('class') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const manager = getCodeLookupManager();

    // Get single drug by ID
    if (id) {
      const result = manager.getDrug(id);
      if (!result) {
        return NextResponse.json(
          { error: 'Drug not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    // Get single drug by name
    if (name) {
      const result = manager.getDrugByName(name);
      if (!result) {
        return NextResponse.json(
          { error: 'Drug not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    // Search drugs
    if (query) {
      const results = manager.searchDrugs(query, { limit, category: drugClass });
      return NextResponse.json({ results, count: results.length });
    }

    return NextResponse.json(
      { error: 'Provide q (search query), id, or name parameter' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[Drugs API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to search drugs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { drugs } = body;

    if (!drugs || !Array.isArray(drugs)) {
      return NextResponse.json(
        { error: 'Provide drugs array in request body' },
        { status: 400 }
      );
    }

    const manager = getCodeLookupManager();
    const count = manager.bulkAddDrugs(drugs);

    return NextResponse.json({
      message: `Successfully added ${count} drugs`,
      count
    });
  } catch (error: unknown) {
    console.error('[Drugs API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to add drugs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
