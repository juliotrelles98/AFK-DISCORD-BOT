import {
  createAudioPlayer,
  createAudioResource,
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  AudioResource,
} from '@discordjs/voice';
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextBasedChannel,
  type ButtonInteraction,
  type Message,
} from 'discord.js';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { MusicQueue, Track } from './queue.js';
import { searchMusic } from './search.js';
import type { ParsedCommand } from '../commands/parser.js';

const execFileAsync = promisify(execFile);

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return 'En vivo / Desconocido';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export class MusicPlayer {
  public player: AudioPlayer;
  public queue: MusicQueue;
  private connection: VoiceConnection | null = null;
  private textChannel: TextBasedChannel | null = null;
  private currentUiMessage: Message | null = null;
  private currentFfmpeg: ChildProcess | null = null;
  private currentResource: AudioResource | null = null;
  public volume = 80; // 0-100
  public isPaused = false;

  constructor() {
    this.queue = new MusicQueue();
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.cleanupProcess();
      // Auto play next track in queue if available
      const nextTrack = this.queue.next();
      if (nextTrack) {
        console.log(`[PLAYER] 🎵 Siguiente en la cola: ${nextTrack.title}`);
        this.playTrack(nextTrack);
      } else {
        this.updateUI().catch(() => {});
      }
    });

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log('[PLAYER] 🔊 Audio transmitiéndose en vivo al canal de voz');
      this.updateUI().catch(() => {});
    });

    this.player.on('error', (error) => {
      console.error('[PLAYER] Error en el reproductor de audio:', error.message);
      this.cleanupProcess();
      this.updateUI().catch(() => {});
    });
  }

  setConnection(connection: VoiceConnection, textChannel?: TextBasedChannel): void {
    this.connection = connection;
    if (textChannel) {
      this.textChannel = textChannel;
    }
    connection.subscribe(this.player);

    // Initial 250ms silence frame to prime Discord voice UDP
    const silentFrames = Buffer.alloc(48000 * 2 * 2 * 0.25);
    const silenceResource = createAudioResource(Readable.from(silentFrames), {
      inputType: StreamType.Raw,
    });
    this.player.play(silenceResource);
    console.log('[PLAYER] Conectado y suscrito al canal de voz');
  }

  setTextChannel(channel: TextBasedChannel): void {
    this.textChannel = channel;
  }

  private cleanupProcess(): void {
    if (this.currentFfmpeg) {
      try {
        this.currentFfmpeg.kill('SIGKILL');
      } catch {}
      this.currentFfmpeg = null;
    }
  }

  private async playTrack(track: Track): Promise<void> {
    this.cleanupProcess();

    console.log(`[PLAYER] 🚀 Obteniendo stream para: "${track.title}"`);

    // Get direct media CDN stream URL with yt-dlp
    let streamUrl = track.url;
    try {
      const { stdout } = await execFileAsync('yt-dlp', [
        '-f', 'bestaudio/best',
        '-g',
        track.url,
      ]);
      const directUrl = stdout.trim().split('\n')[0];
      if (directUrl) {
        streamUrl = directUrl;
      }
    } catch (e) {
      console.warn('[PLAYER] Fallback using direct url:', e);
    }

    // Direct FFmpeg decode to 48kHz stereo s16le PCM
    const ffmpeg = spawn('ffmpeg', [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-i', streamUrl,
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      '-loglevel', 'error',
      'pipe:1',
    ], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    this.currentFfmpeg = ffmpeg;

    ffmpeg.on('error', (err) => {
      console.error('[PLAYER] FFmpeg stream error:', err);
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true,
    });

    resource.volume?.setVolume(this.volume / 100);
    this.currentResource = resource;

    this.player.play(resource);
    this.isPaused = false;
    console.log(`[PLAYER] ▶️ Reproduciendo ahora: "${track.title}" (Volumen: ${this.volume}%)`);

    await this.updateUI();
  }

  /**
   * Build and update the visual interactive UI embed with playback controls and queue list.
   */
  async updateUI(): Promise<void> {
    if (!this.textChannel) return;

    const currentTrack = this.queue.current();
    const upcoming = this.queue.getUpcomingTracks();
    const isPlaying = this.player.state.status === AudioPlayerStatus.Playing;

    const embed = new EmbedBuilder();

    if (currentTrack) {
      embed
        .setTitle('🎧 DJ Voice Bot — Reproductor Musical')
        .setColor(isPlaying ? 0x00e676 : 0xffa000)
        .setDescription(`🎵 **[${currentTrack.title}](${currentTrack.url})**`)
        .addFields(
          {
            name: '⏱️ Duración',
            value: formatDuration(currentTrack.duration),
            inline: true,
          },
          {
            name: '👤 Pedida por',
            value: currentTrack.requestedBy,
            inline: true,
          },
          {
            name: '🔊 Volumen',
            value: `${this.volume}%`,
            inline: true,
          },
          {
            name: '⚡ Estado',
            value: isPlaying ? '▶️ Reproduciendo' : (this.isPaused ? '⏸️ En pausa' : '⏹️ Detenido'),
            inline: true,
          }
        );

      if (currentTrack.thumbnail) {
        embed.setThumbnail(currentTrack.thumbnail);
      }

      // Queue listing
      if (upcoming.length > 0) {
        const queueList = upcoming
          .slice(0, 5)
          .map((t, idx) => `\`${idx + 1}.\` **${t.title}** \`[${formatDuration(t.duration)}]\` — *${t.requestedBy}*`)
          .join('\n');

        const extra = upcoming.length > 5 ? `\n*...y ${upcoming.length - 5} más en cola*` : '';

        embed.addFields({
          name: `📜 Cola de reproducción (${upcoming.length} ${upcoming.length === 1 ? 'canción' : 'canciones'})`,
          value: queueList + extra,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '📜 Cola de reproducción',
          value: '*No hay más canciones en espera. ¡Di: "DJ pon [canción]" para agregar!*',
          inline: false,
        });
      }

      embed.setFooter({
        text: '💡 Comandos de voz: "DJ siguiente", "DJ pausa", "DJ continúa", "DJ pon [canción]"',
      });
    } else {
      embed
        .setTitle('🎧 DJ Voice Bot — En Espera')
        .setColor(0x5865f2)
        .setDescription('😴 **No hay ninguna canción reproduciéndose actualmente.**\n\n🎤 **Habla en el canal de voz:**\n• *"DJ pon [canción]"*\n• *"DJ pon Bad Bunny"*\n• *"DJ pon The Weeknd"*')
        .addFields({
          name: '🔊 Volumen actual',
          value: `${this.volume}%`,
          inline: true,
        });
    }

    // Interactive Buttons Row
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause_resume')
        .setLabel(this.isPaused ? '▶️ Reanudar' : '⏸️ Pausar')
        .setStyle(this.isPaused ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(!currentTrack),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('⏭️ Siguiente')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(upcoming.length === 0 && !currentTrack),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('⏹️ Detener')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!currentTrack && upcoming.length === 0),
      new ButtonBuilder()
        .setCustomId('music_vol_down')
        .setLabel('🔉 -15%')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_vol_up')
        .setLabel('🔊 +15%')
        .setStyle(ButtonStyle.Secondary)
    );

    try {
      if (this.currentUiMessage && this.currentUiMessage.editable) {
        await this.currentUiMessage.edit({
          embeds: [embed],
          components: [row],
        });
      } else if (this.textChannel && 'send' in this.textChannel) {
        this.currentUiMessage = await (this.textChannel as { send: Function }).send({
          embeds: [embed],
          components: [row],
        });
      }
    } catch (err) {
      console.error('[UI] Error actualizando mensaje interactivo en Discord:', err);
    }
  }

  /**
   * Handle button clicks from the Discord UI panel.
   */
  async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    const userName = member?.displayName || interaction.user.username;

    switch (interaction.customId) {
      case 'music_pause_resume': {
        if (this.player.state.status === AudioPlayerStatus.Playing) {
          this.player.pause();
          this.isPaused = true;
          await interaction.deferUpdate();
          await this.updateUI();
        } else if (this.isPaused || this.player.state.status === AudioPlayerStatus.Paused) {
          this.player.unpause();
          this.isPaused = false;
          await interaction.deferUpdate();
          await this.updateUI();
        } else {
          await interaction.reply({ content: '❌ No hay música sonando.', ephemeral: true });
        }
        break;
      }

      case 'music_skip': {
        console.log(`[BUTTON] ⏭️ ${userName} saltó la canción con botón`);
        this.player.stop();
        await interaction.deferUpdate();
        await this.updateUI();
        break;
      }

      case 'music_stop': {
        console.log(`[BUTTON] ⏹️ ${userName} detuvo la música con botón`);
        this.queue.clear();
        this.player.stop();
        this.cleanupProcess();
        this.isPaused = false;
        await interaction.deferUpdate();
        await this.updateUI();
        break;
      }

      case 'music_vol_down': {
        this.volume = Math.max(5, this.volume - 15);
        this.currentResource?.volume?.setVolume(this.volume / 100);
        console.log(`[BUTTON] 🔉 ${userName} bajó el volumen a ${this.volume}%`);
        await interaction.deferUpdate();
        await this.updateUI();
        break;
      }

      case 'music_vol_up': {
        this.volume = Math.min(100, this.volume + 15);
        this.currentResource?.volume?.setVolume(this.volume / 100);
        console.log(`[BUTTON] 🔊 ${userName} subió el volumen a ${this.volume}%`);
        await interaction.deferUpdate();
        await this.updateUI();
        break;
      }

      default:
        break;
    }
  }

  async handleCommand(command: ParsedCommand, username: string = 'Usuario'): Promise<string> {
    switch (command.action) {
      case 'play': {
        const query = command.query?.trim();
        if (!query) {
          if (this.isPaused) {
            this.player.unpause();
            this.isPaused = false;
            await this.updateUI();
            return '▶️ Música reanudada';
          }
          return '❓ ¿Qué canción quieres escuchar? Di: "DJ pon [nombre]"';
        }

        console.log(`[PLAYER] 🔍 Buscando: "${query}"...`);
        const result = await searchMusic(query);

        if (!result) {
          console.log(`[PLAYER] ❌ No se encontró música para: "${query}"`);
          return `❌ No encontré "${query}". Intenta con otro nombre.`;
        }

        const track: Track = {
          title: result.title,
          url: result.url,
          duration: result.duration,
          requestedBy: username,
          thumbnail: result.thumbnail,
          artist: result.artist,
        };

        const queueLength = this.queue.add(track);

        // If currently idle, play immediately
        if (this.player.state.status === AudioPlayerStatus.Idle) {
          this.queue.next();
          await this.playTrack(track);
          return `🎵 Reproduciendo: **${track.title}**`;
        } else {
          await this.updateUI();
          return `➕ Añadido a la cola (#${queueLength}): **${track.title}**`;
        }
      }

      case 'pause': {
        if (this.player.state.status === AudioPlayerStatus.Playing) {
          this.player.pause();
          this.isPaused = true;
          console.log('[PLAYER] ⏸️ Pausado');
          await this.updateUI();
          return '⏸️ Música pausada';
        }
        return 'No hay música sonando';
      }

      case 'resume': {
        if (this.isPaused || this.player.state.status === AudioPlayerStatus.Paused) {
          this.player.unpause();
          this.isPaused = false;
          console.log('[PLAYER] ▶️ Reanudado');
          await this.updateUI();
          return '▶️ Música reanudada';
        }
        return 'La música ya está sonando';
      }

      case 'skip': {
        console.log('[PLAYER] ⏭️ Saltando canción...');
        this.player.stop(); // Triggers idle event which plays next track
        await this.updateUI();
        return '⏭️ Canción saltada';
      }

      case 'stop': {
        this.queue.clear();
        this.player.stop();
        this.cleanupProcess();
        this.isPaused = false;
        console.log('[PLAYER] ⏹️ Reproducción detenida y cola vaciada');
        await this.updateUI();
        return '⏹️ Música detenida';
      }

      case 'volume_up': {
        this.volume = Math.min(100, this.volume + 15);
        this.currentResource?.volume?.setVolume(this.volume / 100);
        console.log(`[PLAYER] 🔊 Volumen subido a ${this.volume}%`);
        await this.updateUI();
        return `🔊 Volumen: ${this.volume}%`;
      }

      case 'volume_down': {
        this.volume = Math.max(5, this.volume - 15);
        this.currentResource?.volume?.setVolume(this.volume / 100);
        console.log(`[PLAYER] 🔉 Volumen bajado a ${this.volume}%`);
        await this.updateUI();
        return `🔉 Volumen: ${this.volume}%`;
      }

      default:
        return 'Comando no reconocido';
    }
  }
}

// Global music player singleton
export const musicPlayer = new MusicPlayer();
