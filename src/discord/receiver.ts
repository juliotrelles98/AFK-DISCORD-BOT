import {
  VoiceConnection,
  EndBehaviorType,
} from '@discordjs/voice';
import type { Client } from 'discord.js';
import { config } from '../config.js';
import { convertOpusToPcmWav } from '../speech/audioConverter.js';
import { transcribe } from '../speech/whisper.js';
import { detectWakeWord } from '../speech/wakeWord.js';
import { parseCommand } from '../commands/parser.js';
import { musicPlayer } from '../music/player.js';

/** Track active listeners to avoid duplicates */
const activeListeners = new Set<string>();

/**
 * Start listening to voice audio from all users in the connection.
 */
export function startListening(connection: VoiceConnection, guildId: string, client?: Client): void {
  const receiver = connection.receiver;

  receiver.speaking.on('start', (userId) => {
    const listenerKey = `${guildId}-${userId}`;

    if (activeListeners.has(listenerKey)) return;
    activeListeners.add(listenerKey);

    const opusStream = receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: config.voice.silenceTimeoutMs,
      },
    });

    const chunks: Buffer[] = [];

    opusStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    opusStream.on('end', async () => {
      activeListeners.delete(listenerKey);

      if (chunks.length === 0) {
        return;
      }

      try {
        await processAudio(chunks, userId, guildId, client);
      } catch (error) {
        console.error(`[VOICE] Error procesando audio de ${userId}:`, error);
      }
    });

    opusStream.on('error', (error) => {
      activeListeners.delete(listenerKey);
    });
  });

  console.log('[VOICE] Listening for wake word "DJ"...');
}

/**
 * Process captured audio: convert, transcribe, detect wake word, parse command.
 */
async function processAudio(chunks: Buffer[], userId: string, guildId: string, client?: Client): Promise<void> {
  const opusBuffer = Buffer.concat(chunks);

  // Skip very short audio
  if (opusBuffer.length < 1000) {
    return;
  }

  // Step 1: Convert Opus to WAV
  let wavBuffer: Buffer;
  try {
    wavBuffer = await convertOpusToPcmWav(chunks);
  } catch {
    return;
  }

  // Step 2: Transcribe with Whisper
  let transcription: string;
  try {
    transcription = await transcribe(wavBuffer);
  } catch {
    return;
  }

  if (!transcription || transcription.trim().length === 0) {
    return;
  }

  // Step 3: Check wake word "DJ"
  const wakeResult = detectWakeWord(transcription);

  // If the wake word wasn't said, silently ignore (do not listen to/log casual conversation)
  if (!wakeResult.detected) {
    return;
  }

  // Resolve username for the command log
  let userName = userId;
  if (client) {
    try {
      const guild = client.guilds.cache.get(guildId);
      const member = guild?.members.cache.get(userId) || (await guild?.members.fetch(userId).catch(() => null));
      userName = member?.displayName || member?.user?.username || (client.users.cache.get(userId)?.username ?? userId);
    } catch {
      userName = userId;
    }
  }

  console.log(`[VOICE] 👤 Usuario: ${userName}`);
  console.log(`[TRANSCRIPTION] "${transcription}"`);
  console.log(`[WAKE WORD] 🎯 Detectado ("${wakeResult.wakeWord ?? 'DJ'}")`);

  // Step 4: Parse command
  const command = parseCommand(wakeResult.command);

  if (command) {
    console.log(`[COMMAND] ${JSON.stringify(command)}`);
    const result = await musicPlayer.handleCommand(command, userName);
    console.log(`[BOT] ${result}`);
  } else {
    console.log(`[COMMAND] Comando no reconocido: "${wakeResult.command}"`);
  }
}
