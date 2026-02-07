// app/api/stt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSttService } from '@/app/lib/voice/server/sttService';

export const runtime = 'nodejs';

const DEBUG_METRICS = process.env.DEBUG_METRICS === 'true';
const MAX_AUDIO_BYTES = Number(process.env.STT_MAX_AUDIO_BYTES || 15 * 1024 * 1024);

async function extractAudioBuffer(req: NextRequest): Promise<Buffer> {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const audioFile = formData.get('audio');

    if (!(audioFile instanceof Blob)) {
      throw new Error('No audio file provided');
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const body = await req.arrayBuffer();
  return Buffer.from(body);
}

function classifySttError(errorMessage: string): { status: number; message: string } {
  if (errorMessage.toLowerCase().includes('timeout')) {
    return { status: 408, message: 'Transcription timeout - audio may be too long' };
  }
  if (errorMessage.toLowerCase().includes('no audio')) {
    return { status: 400, message: 'No audio provided' };
  }
  if (
    errorMessage.toLowerCase().includes('whisper.cpp server required') ||
    errorMessage.toLowerCase().includes('whisper server')
  ) {
    return { status: 503, message: errorMessage };
  }
  return { status: 500, message: errorMessage };
}

export async function POST(req: NextRequest) {
  const requestStart = Date.now();

  try {
    const audioBuffer = await extractAudioBuffer(req);

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Audio payload is empty' },
        { status: 400 }
      );
    }

    if (audioBuffer.length > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio payload too large (max ${MAX_AUDIO_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const result = await getSttService().transcribe(audioBuffer);
    const totalDurationMs = Date.now() - requestStart;

    if (DEBUG_METRICS) {
      console.log(
        `[Metrics] STT ${result.backend} duration: ${result.durationMs}ms (total ${totalDurationMs}ms, bytes ${audioBuffer.length})`
      );
    }

    return NextResponse.json({
      success: true,
      text: result.text,
      language: result.language,
      confidence: result.confidence,
      segments: result.segments,
      duration: result.durationMs,
      totalDurationMs,
      backend: result.backend,
      message: result.text.length === 0 ? 'No speech detected in audio' : undefined
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown STT error';
    console.error('[STT] Fatal error:', errorMessage);

    const classified = classifySttError(errorMessage);
    return NextResponse.json(
      { error: classified.message },
      { status: classified.status }
    );
  }
}
