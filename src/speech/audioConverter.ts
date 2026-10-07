import { spawn } from 'child_process';
import { config } from '../config.js';

/**
 * Convert an array of Opus packet buffers (from Discord voice receiver) to a single WAV buffer.
 * 
 * Discord's VoiceReceiver.subscribe() returns raw Opus packets.
 * We decode Opus → PCM (48kHz stereo) using opusscript, then use FFmpeg to resample to 16kHz mono WAV.
 */
export function convertOpusToPcmWav(opusChunks: Buffer[]): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // Dynamically import opusscript (CommonJS module)
      const OpusScript = (await import('opusscript')).default;
      
      // Discord sends 48kHz stereo Opus
      const decoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);

      // Step 1: Decode Opus packets to raw PCM
      const pcmChunks: Buffer[] = [];

      for (const opusPacket of opusChunks) {
        try {
          const decoded = decoder.decode(opusPacket);
          pcmChunks.push(Buffer.from(decoded.buffer, decoded.byteOffset, decoded.byteLength));
        } catch {
          // Skip malformed packets
          continue;
        }
      }

      decoder.delete();

      if (pcmChunks.length === 0) {
        reject(new Error('No valid Opus packets could be decoded'));
        return;
      }

      const pcmBuffer = Buffer.concat(pcmChunks);

      // Step 2: Use FFmpeg to convert PCM (48kHz stereo s16le) → WAV (16kHz mono)
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-i', 'pipe:0',
        '-ar', config.voice.sampleRate.toString(),
        '-ac', config.voice.channels.toString(),
        '-f', 'wav',
        'pipe:1',
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const outputChunks: Buffer[] = [];
      let stderrData = '';

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        outputChunks.push(chunk);
      });

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderrData += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(Buffer.concat(outputChunks));
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrData}`));
        }
      });

      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });

      // Write decoded PCM data to ffmpeg stdin
      ffmpeg.stdin.write(pcmBuffer);
      ffmpeg.stdin.end();
    } catch (error) {
      reject(error);
    }
  });
}
