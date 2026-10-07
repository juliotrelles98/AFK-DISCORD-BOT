import { config } from '../config.js';

interface WhisperResponse {
  text: string;
  language: string;
  language_probability: number;
  duration: number;
}

/**
 * Send a WAV audio buffer to the local faster-whisper server for transcription.
 */
export async function transcribe(wavBuffer: Buffer): Promise<string> {
  const url = `${config.whisper.url}/transcribe`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
      },
      body: wavBuffer,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Whisper server error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as WhisperResponse;
    return data.text;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Whisper transcription timed out (10s)');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if the Whisper server is running and healthy.
 */
export async function checkWhisperHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.whisper.url}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3_000),
    });
    const data = (await response.json()) as { status: string; model_loaded: boolean };
    return data.status === 'ok' && data.model_loaded;
  } catch {
    return false;
  }
}
