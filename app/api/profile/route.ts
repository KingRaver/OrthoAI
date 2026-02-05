// app/api/profile/route.ts
// API endpoints for user profile management

import { NextRequest, NextResponse } from 'next/server';
import { getMemoryManager } from '@/app/lib/memory';

/**
 * GET /api/profile
 * Fetch the user's profile
 */
export async function GET() {
  try {
    const memory = getMemoryManager();
    const profile = memory.getUserProfile();

    if (!profile) {
      return NextResponse.json({ profile: null }, { status: 200 });
    }

    // Parse the profile string into structured fields
    const profileObj: Record<string, string> = {};
    const lines = profile.profile.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        profileObj[key] = value;
      }
    }

    return NextResponse.json({
      profile: profileObj,
      updated_at: profile.updated_at,
      embedding_status: profile.embedding_status,
    });
  } catch (error) {
    console.error('[API /profile GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * Update the user's profile (requires consent)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile, consent } = body;

    if (!consent) {
      return NextResponse.json(
        { error: 'Profile consent required' },
        { status: 403 }
      );
    }

    if (!profile || typeof profile !== 'string') {
      return NextResponse.json(
        { error: 'Invalid profile data' },
        { status: 400 }
      );
    }

    const memory = getMemoryManager();
    await memory.saveUserProfile(profile, consent);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /profile POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile
 * Clear the user's profile
 */
export async function DELETE() {
  try {
    const memory = getMemoryManager();
    await memory.clearUserProfile();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API /profile DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear profile' },
      { status: 500 }
    );
  }
}
