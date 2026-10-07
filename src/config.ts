import 'dotenv/config';

// Ensure Homebrew and standard binary paths are in PATH
if (!process.env.PATH?.includes('/opt/homebrew/bin')) {
  process.env.PATH = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}`;
}

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN ?? '',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
  },
  whisper: {
    url: process.env.WHISPER_URL ?? 'http://localhost:8787',
    model: process.env.WHISPER_MODEL ?? 'base',
  },
  voice: {
    /** Max audio buffer duration in milliseconds */
    maxBufferMs: 15_000,
    /** Silence timeout before sending audio for transcription (ms) */
    silenceTimeoutMs: 1_500,
    /** Sample rate for output audio */
    sampleRate: 16_000,
    /** Number of audio channels */
    channels: 1,
  },
} as const;
