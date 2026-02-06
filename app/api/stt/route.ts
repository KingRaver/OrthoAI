// app/api/stt/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEBUG_METRICS = process.env.DEBUG_METRICS === 'true';

/**
 * STT API - Speech-to-Text transcription using local Whisper
 *
 * This implementation uses OpenAI's Whisper CLI for accurate,
 * private, on-device speech-to-text transcription.
 *
 * Process:
 * 1. Receives WAV audio from client
 * 2. Writes to temporary file
 * 3. Calls whisper CLI subprocess
 * 4. Parses JSON output
 * 5. Returns transcript
 * 6. Cleans up temp files
 *
 * Requirements:
 * - Whisper CLI: pip3 install openai-whisper
 * - Model downloaded: whisper --model small --task transcribe /dev/null
 */

interface WhisperJsonOutput {
  text: string;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  language?: string;
}

export async function POST(req: NextRequest) {
  let tempAudioPath: string | null = null;
  let tempJsonPath: string | null = null;
  const requestStart = Date.now();

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as Blob;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Get audio buffer from blob
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (audioBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Audio file is empty' },
        { status: 400 }
      );
    }

    // Create temporary file paths
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const audioFileName = `whisper-${timestamp}`;
    tempAudioPath = path.join(tempDir, `${audioFileName}.wav`);
    tempJsonPath = path.join(tempDir, `${audioFileName}.json`);

    // Write audio buffer to temporary WAV file
    fs.writeFileSync(tempAudioPath, audioBuffer);
    console.log(`[STT] Audio file created: ${tempAudioPath} (${audioBuffer.length} bytes)`);

    // Debug: Save a copy to inspect (opt-in)
    if (process.env.STT_DEBUG_AUDIO === 'true') {
      const debugPath = path.join(tempDir, 'debug-latest.wav');
      fs.copyFileSync(tempAudioPath, debugPath);
      console.log(`[STT] Debug copy saved to: ${debugPath}`);
    }

    // Build whisper command with full path
    // --model small: 330MB model, good balance of speed/accuracy
    // --task transcribe: transcribe audio to same language (not translate)
    // --output_format json: structured output with timestamps and segments
    // --output_dir: control where JSON is written (Whisper auto-names the file)
    const whisperBin = process.env.WHISPER_PATH || '/Users/jeffspirlock/Library/Python/3.11/bin/whisper';
    const whisperArgs = [
      tempAudioPath,
      '--model', 'small',
      '--task', 'transcribe',
      '--output_format', 'json',
      '--output_dir', tempDir
    ];

    console.log('[STT] Starting Whisper transcription...');
    const startTime = Date.now();

    try {
      await new Promise<void>((resolve, reject) => {
        const whisperProcess = spawn(whisperBin, whisperArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderrOutput = '';

        whisperProcess.stderr.on('data', (data) => {
          stderrOutput += data.toString();
        });

        whisperProcess.on('error', (err) => {
          reject(err);
        });

        const timeoutId = setTimeout(() => {
          whisperProcess.kill();
          reject(new Error('ETIMEDOUT'));
        }, 60000);

        whisperProcess.on('close', (code) => {
          clearTimeout(timeoutId);
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderrOutput || `Whisper exited with code ${code}`));
          }
        });
      });

      const duration = Date.now() - startTime;
      console.log(`[STT] Transcription completed in ${duration}ms`);
      if (DEBUG_METRICS) {
        console.log(`[Metrics] STT duration: ${duration}ms (total ${Date.now() - requestStart}ms)`);
      }

      // Verify JSON output file was created
      if (!fs.existsSync(tempJsonPath)) {
        throw new Error(`Whisper output file not found at ${tempJsonPath}`);
      }

      // Parse whisper's JSON output
      const jsonOutput = fs.readFileSync(tempJsonPath, 'utf-8');
      const parsedOutput: WhisperJsonOutput = JSON.parse(jsonOutput);

      // Handle empty transcription (no speech detected)
      if (!parsedOutput.text || parsedOutput.text.trim().length === 0) {
        console.log('[STT] No speech detected in audio');
        return NextResponse.json({
          success: true,
          text: '',
          message: 'No speech detected in audio',
          language: parsedOutput.language || 'unknown',
          duration
        });
      }

      // Return successful transcription
      console.log(`[STT] Transcript: "${parsedOutput.text.trim()}" (${parsedOutput.language})`);
      return NextResponse.json({
        success: true,
        text: parsedOutput.text.trim(),
        language: parsedOutput.language || 'en',
        segments: parsedOutput.segments || [],
        duration
      });

    } catch (execError: unknown) {
      const errorMsg =
        execError instanceof Error ? execError.message : String(execError);

      // Handle specific error types
      if (errorMsg.includes('ETIMEDOUT')) {
        return NextResponse.json(
          { error: 'Transcription timeout - audio may be too long' },
          { status: 408 }
        );
      }

      if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
        return NextResponse.json(
          {
            error: 'Whisper CLI not found or not in PATH',
            hint: 'Install: pip3 install openai-whisper && whisper --model small --task transcribe /dev/null'
          },
          { status: 500 }
        );
      }

      // Re-throw other errors for generic handling below
      throw execError;
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[STT] Fatal error:', errorMessage);

    return NextResponse.json(
      { error: `STT failed: ${errorMessage}` },
      { status: 500 }
    );

  } finally {
    // Cleanup temporary files (always run, even on error)
    [tempAudioPath, tempJsonPath].forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`[STT] Cleaned up: ${filePath}`);
        } catch (cleanupError) {
          console.warn(`[STT] Failed to cleanup ${filePath}:`, cleanupError);
        }
      }
    });
  }
}
