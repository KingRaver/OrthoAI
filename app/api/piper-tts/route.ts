import { NextRequest, NextResponse } from 'next/server';
import { getPiperService } from '@/app/lib/voice/server/piperService';

export const runtime = 'nodejs';

const DEBUG_METRICS = process.env.DEBUG_METRICS === 'true';

interface PiperTTSRequest {
  text: string;
  voice?: string;
}

function classifyTtsError(errorMessage: string): { status: number; message: string } {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes('not found')) {
    return { status: 404, message: errorMessage };
  }
  if (normalized.includes('empty')) {
    return { status: 400, message: errorMessage };
  }
  if (normalized.includes('too long')) {
    return { status: 400, message: errorMessage };
  }
  if (normalized.includes('timeout')) {
    return { status: 504, message: errorMessage };
  }
  return { status: 500, message: errorMessage };
}

/**
 * GET /api/piper-tts
 * Query: ?q=voice-name&limit=10
 * Returns list of available Piper voices
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : null;

    const { voices, voiceDir } = getPiperService().getAvailableVoices(query, limit);

    return NextResponse.json({
      success: true,
      voices,
      count: voices.length,
      voiceDir
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Failed to list voices: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * POST /api/piper-tts
 * Body: { text: string, voice?: string }
 * Returns: WAV audio synthesized by a persistent Piper worker
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestStart = Date.now();

  try {
    const { text, voice = 'en_US-libritts-high' } = await req.json() as PiperTTSRequest;

    if (typeof text !== 'string') {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    const result = await getPiperService().synthesize(text, voice);
    const totalDurationMs = Date.now() - requestStart;

    if (DEBUG_METRICS) {
      console.log(
        `[Metrics] TTS piper-worker duration: ${result.durationMs}ms (total ${totalDurationMs}ms, bytes ${result.audioBuffer.length})`
      );
    }

    const audioBytes = Uint8Array.from(result.audioBuffer);

    return new NextResponse(audioBytes, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBytes.length.toString(),
        'Cache-Control': 'no-cache',
        'X-TTS-Backend': result.backend,
        'X-TTS-Duration-Ms': String(result.durationMs),
        'X-TTS-Total-Duration-Ms': String(totalDurationMs)
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Piper] Request error:', errorMessage);

    const classified = classifyTtsError(errorMessage);
    return NextResponse.json(
      { error: classified.message },
      { status: classified.status }
    );
  }
}
