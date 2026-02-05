// app/api/tts/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * TTS API - Returns instructions for client-side speech synthesis
 *
 * This implementation uses a hybrid approach:
 * 1. Returns metadata telling the client to use browser-based TTS (Web Speech API)
 * 2. This avoids server-side dependencies and works immediately
 *
 * For server-side TTS in the future, you could integrate:
 * - Local LLM runtime with TTS model support (if available)
 * - Piper TTS (requires proper Python environment)
 * - Third-party APIs (ElevenLabs, OpenAI TTS, etc.)
 */

interface TTSRequest {
  text: string;
  voice?: string;
  rate?: number;
  pitch?: number;
}

/**
 * POST /api/tts
 * Body: { text: string, voice?: string, rate?: number, pitch?: number }
 * Returns: JSON with TTS instructions for client-side synthesis
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice, rate = 1.0, pitch = 1.0 } = await req.json() as TTSRequest;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    if (text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text cannot be empty' },
        { status: 400 }
      );
    }

    // Limit text length to prevent abuse
    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Return instructions for client-side synthesis
    return NextResponse.json({
      success: true,
      method: 'client-side',
      text: text.trim(),
      voice: voice || 'default',
      rate: Math.max(0.1, Math.min(10, rate)),
      pitch: Math.max(0, Math.min(2, pitch)),
      instructions: 'Use Web Speech API speechSynthesis on the client'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TTS route error:', errorMessage);

    return NextResponse.json(
      { error: `TTS request failed: ${errorMessage}` },
      { status: 400 }
    );
  }
}
