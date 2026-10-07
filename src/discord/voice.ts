import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { VoiceBasedChannel } from 'discord.js';

/**
 * Join a voice channel with selfDeaf: false and selfMute: false so the bot can hear users.
 */
export function joinChannel(channel: VoiceBasedChannel): VoiceConnection {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
    debug: true,
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[VOICE] Connection state: ${oldState.status} -> ${newState.status}`);
  });

  connection.on('debug', (message) => {
    console.log(`[VOICE DEBUG] ${message}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.log('[VOICE] Disconnected, attempting to reconnect...');
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      console.log('[VOICE] Could not reconnect, destroying connection');
      connection.destroy();
    }
  });

  connection.on('error', (error) => {
    console.error('[VOICE] Connection error:', error);
  });

  return connection;
}

/**
 * Leave the voice channel for a given guild.
 * Returns true if a connection existed and was destroyed.
 */
export function leaveChannel(guildId: string): boolean {
  const connection = getVoiceConnection(guildId);
  if (connection) {
    connection.destroy();
    console.log('[VOICE] Left voice channel');
    return true;
  }
  return false;
}
