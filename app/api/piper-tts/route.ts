// app/api/piper-tts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DEBUG_METRICS = process.env.DEBUG_METRICS === 'true';

interface PiperTTSRequest {
  text: string;
  voice?: string; // e.g., 'en_US-libritts-high'
}

type PiperAvailability = { ok: true } | { ok: false; error: string };
const piperAvailabilityCache = new Map<string, PiperAvailability>();

function checkPiperAvailability(command: string): PiperAvailability {
  const cached = piperAvailabilityCache.get(command);
  if (cached) return cached;

  try {
    execSync(command, { stdio: 'pipe', timeout: 10000 });
    const ok: PiperAvailability = { ok: true };
    piperAvailabilityCache.set(command, ok);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const fail: PiperAvailability = { ok: false, error: message };
    piperAvailabilityCache.set(command, fail);
    return fail;
  }
}

/**
 * GET /api/piper-tts/voices
 * Returns list of available Piper voices
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q')?.toLowerCase().trim() || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(0, parseInt(limitParam, 10)) : null;

    const voiceDir = path.join(os.homedir(), '.piper', 'models');

    // Check if voice directory exists
    if (!fs.existsSync(voiceDir)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Voice directory not found. Install Piper models first.',
          voiceDir
        },
        { status: 404 }
      );
    }

    // List all .onnx files (voice models)
    const files = fs.readdirSync(voiceDir);
    let voices = files
      .filter(f => f.endsWith('.onnx'))
      .map(f => f.replace('.onnx', ''));

    if (query) {
      voices = voices.filter(v => v.toLowerCase().includes(query));
    }

    if (limit !== null) {
      voices = voices.slice(0, limit);
    }

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
 * Returns: Audio blob in mp3 format
 *
 * Uses Piper TTS via Python CLI (python3 -m piper)
 * Voice models stored in ~/.piper/models/
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let tempOutputFile: string | null = null;
  const requestStart = Date.now();

  try {
    const { text, voice = 'en_US-libritts-high' } = await req.json() as PiperTTSRequest;

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

    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Text too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    const voiceDir = path.join(os.homedir(), '.piper', 'models');
    const modelPath = path.join(voiceDir, `${voice}.onnx`);

    // Verify voice model exists
    if (!fs.existsSync(modelPath)) {
      return NextResponse.json(
        {
          error: `Voice model not found: ${voice}`,
          availableAt: voiceDir,
          modelPath
        },
        { status: 404 }
      );
    }

    // Create temporary output file in /tmp
    const tempDir = os.tmpdir();
    tempOutputFile = path.join(tempDir, `piper-${Date.now()}.wav`);

    console.log(`[Piper] Generating speech for text (${text.length} chars): "${text.substring(0, 50)}..."`);
    console.log(`[Piper] Model: ${modelPath}`);
    console.log(`[Piper] Output: ${tempOutputFile}`);

    // Execute Piper via Python with performance optimizations
    // Using: echo "text" | python3 -m piper --model /path/to/model.onnx --output_file /tmp/output.wav
    return new Promise((resolve) => {
      try {
        // Spawn Python process with piper
        // On macOS, optionally force ARM64 via `arch -arm64` (default on)
        // Add length_scale for faster speech and sentence_silence for snappier output
        const pythonCmd = process.env.PIPER_PYTHON_CMD || 'python3';
        const useArch = process.platform === 'darwin' && process.env.PIPER_FORCE_ARM64 !== 'false';
        const availabilityCommand = useArch
          ? `arch -arm64 ${pythonCmd} -m piper --help`
          : `${pythonCmd} -m piper --help`;
        const availability = checkPiperAvailability(availabilityCommand);
        if (!availability.ok) {
          resolve(
            NextResponse.json(
              { error: `Piper is not available: ${availability.error}` },
              { status: 500 }
            )
          );
          return;
        }
        const piperArgs = [
          '-m',
          'piper',
          '--model',
          modelPath,
          '--output_file',
          tempOutputFile as string,
          '--length_scale',
          '0.85', // Speed up speech by 15% (values < 1.0 = faster)
          '--sentence_silence',
          '0.2' // Reduce silence between sentences for faster output
        ];

        const piperProcess = useArch
          ? spawn('arch', ['-arm64', pythonCmd, ...piperArgs])
          : spawn(pythonCmd, piperArgs);

        let stderrOutput = '';
        let stdoutOutput = '';

        // Write text to stdin
        piperProcess.stdin.write(text);
        piperProcess.stdin.end();

        // Capture stdout for debugging
        piperProcess.stdout.on('data', (data) => {
          stdoutOutput += data.toString();
        });

        // Capture stderr for debugging
        piperProcess.stderr.on('data', (data) => {
          stderrOutput += data.toString();
        });

        // Handle process completion
        piperProcess.on('close', (code) => {
          clearTimeout(timeoutId);
          console.log(`[Piper] Process exited with code ${code}`);
          console.log(`[Piper] stdout: ${stdoutOutput || '(empty)'}`);
          console.log(`[Piper] stderr: ${stderrOutput || '(empty)'}`);
          if (DEBUG_METRICS) {
            console.log(`[Metrics] TTS duration: ${Date.now() - requestStart}ms`);
          }

          if (code !== 0) {
            console.error('[Piper] Process failed with code:', code);
            console.error('[Piper] stderr:', stderrOutput);
            resolve(
              NextResponse.json(
                { error: `Piper TTS failed with code ${code}: ${stderrOutput}` },
                { status: 500 }
              )
            );
            return;
          }

          // Read the generated audio file
          if (!fs.existsSync(tempOutputFile as string)) {
            console.error(`[Piper] Audio file not found at: ${tempOutputFile}`);
            resolve(
              NextResponse.json(
                { error: 'Audio file was not generated' },
                { status: 500 }
              )
            );
            return;
          }

          try {
            const audioBuffer = fs.readFileSync(tempOutputFile as string);
            console.log(`[Piper] Generated audio: ${audioBuffer.length} bytes`);

            // Clean up temp file
            fs.unlinkSync(tempOutputFile as string);
            tempOutputFile = null;

            // Return audio as WAV blob
            const response = new NextResponse(audioBuffer, {
              status: 200,
              headers: {
                'Content-Type': 'audio/wav',
                'Content-Length': audioBuffer.length.toString(),
                'Cache-Control': 'no-cache'
              }
            });

            console.log('[Piper] Sending audio response');
            resolve(response);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            resolve(
              NextResponse.json(
                { error: `Failed to read audio file: ${errorMsg}` },
                { status: 500 }
              )
            );
          }
        });

        // Handle process errors
        piperProcess.on('error', (err) => {
          clearTimeout(timeoutId);
          console.error('Failed to start Piper process:', err);
          resolve(
            NextResponse.json(
              { error: `Failed to start Piper: ${err.message}` },
              { status: 500 }
            )
          );
        });

        // Timeout after 60 seconds (model loading can take time on first run)
        const timeoutId = setTimeout(() => {
          if (piperProcess.exitCode === null) {
            console.error('[Piper] Process timeout after 60s');
            piperProcess.kill();
            resolve(
              NextResponse.json(
                { error: 'Piper TTS timeout - try using a smaller voice model' },
                { status: 504 }
              )
            );
          }
        }, 60000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Piper error:', errorMessage);
        resolve(
          NextResponse.json(
            { error: `TTS failed: ${errorMessage}` },
            { status: 500 }
          )
        );
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Request error:', errorMessage);

    // Clean up temp file on error
    if (tempOutputFile && fs.existsSync(tempOutputFile)) {
      try {
        fs.unlinkSync(tempOutputFile);
      } catch (e) {
        if (DEBUG_METRICS) {
          const message = e instanceof Error ? e.message : 'Unknown error';
          console.warn('[Piper] Temp file cleanup failed:', message);
        }
      }
    }

    return NextResponse.json(
      { error: `Request failed: ${errorMessage}` },
      { status: 400 }
    );
  }
}
