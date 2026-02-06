import { NextRequest, NextResponse } from 'next/server';
import { getCodeLookupManager } from '@/app/lib/codes';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const code = searchParams.get('code');
    const category = searchParams.get('category') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const manager = getCodeLookupManager();

    // Get single code by code
    if (code) {
      const result = manager.getCPT(code);
      if (!result) {
        return NextResponse.json(
          { error: 'Code not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(result);
    }

    // Search codes
    if (query) {
      const results = manager.searchCPT(query, { limit, category });
      return NextResponse.json({ results, count: results.length });
    }

    return NextResponse.json(
      { error: 'Provide either q (search query) or code parameter' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[CPT API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to search CPT codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { codes } = body;

    if (!codes || !Array.isArray(codes)) {
      return NextResponse.json(
        { error: 'Provide codes array in request body' },
        { status: 400 }
      );
    }

    const manager = getCodeLookupManager();
    const count = manager.bulkAddCPT(codes);

    return NextResponse.json({
      message: `Successfully added ${count} CPT codes`,
      count
    });
  } catch (error: unknown) {
    console.error('[CPT API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to add CPT codes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
