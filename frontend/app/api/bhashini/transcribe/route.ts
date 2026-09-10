import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const DEFAULT_ENDPOINT = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';
const SUPPORTED_LANGUAGES = new Set(['hi', 'en', 'bn', 'ta']);

interface BhashiniResponse {
  pipelineResponse?: Array<{
    output?: Array<{ source?: unknown }>;
    audio?: Array<{ source?: unknown }>;
  }>;
  error?: unknown;
  message?: unknown;
}

function getProviderError(payload: BhashiniResponse | null): string {
  if (!payload) return '';
  if (typeof payload.error === 'string') return payload.error;
  if (typeof payload.message === 'string') return payload.message;

  const nested = payload.pipelineResponse?.flatMap((item) => [
    ...(item.output ?? []),
    ...(item.audio ?? []),
  ]);
  const detail = nested?.find(
    (item) => typeof item.source === 'string' && item.source.trim()
  )?.source;
  return typeof detail === 'string' ? detail : '';
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.BHASHINI_API_KEY;
  const userId = process.env.BHASHINI_USER_ID;
  if (!apiKey || !userId) {
    return NextResponse.json(
      { error: 'Bhashini is not configured. Set BHASHINI_API_KEY and BHASHINI_USER_ID.' },
      { status: 503 }
    );
  }

  let body: { audio?: unknown; sourceLanguage?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const audio = typeof body.audio === 'string' ? body.audio : '';
  const sourceLanguage =
    typeof body.sourceLanguage === 'string' ? body.sourceLanguage.trim().toLowerCase() : '';
  if (!audio || !sourceLanguage) {
    return NextResponse.json(
      { error: 'audio and sourceLanguage are required.' },
      { status: 400 }
    );
  }
  if (!SUPPORTED_LANGUAGES.has(sourceLanguage)) {
    return NextResponse.json(
      { error: 'sourceLanguage must be one of: hi, en, bn, ta.' },
      { status: 400 }
    );
  }

  let audioBytes: number;
  try {
    audioBytes = Buffer.from(audio, 'base64').byteLength;
  } catch {
    return NextResponse.json({ error: 'audio must be valid base64.' }, { status: 400 });
  }
  if (audioBytes === 0 || audioBytes > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'Audio must be between 1 byte and 10 MB.' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(process.env.BHASHINI_ENDPOINT ?? DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userID: userId,
        ulcaApiKey: apiKey,
      },
      body: JSON.stringify({
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: { sourceLanguage },
              // The client always converts browser recordings to PCM WAV before
              // sending them, regardless of the recorder's original codec.
              audioFormat: 'wav',
              samplingRate: 16000,
            },
          },
        ],
        inputData: { audio: [{ audioContent: audio }] },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Bhashini transcription timed out.' }, { status: 504 });
    }
    console.error('[POST /api/bhashini/transcribe] request failed:', error);
    return NextResponse.json({ error: 'Bhashini transcription failed.' }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const payload = (await response.json().catch(() => null)) as BhashiniResponse | null;
  if (!response.ok) {
    const providerError = getProviderError(payload);
    console.error(
      '[POST /api/bhashini/transcribe] Bhashini request failed:',
      response.status,
      providerError
    );
    return NextResponse.json(
      {
        error: providerError
          ? `Bhashini rejected the recording: ${providerError}`
          : 'Bhashini could not transcribe this recording.',
      },
      { status: 502 }
    );
  }

  const transcript = payload?.pipelineResponse?.[0]?.output?.[0]?.source;
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return NextResponse.json({ error: 'Bhashini returned no transcript.' }, { status: 502 });
  }

  return NextResponse.json({ transcript: transcript.trim(), sourceLanguage });
}
