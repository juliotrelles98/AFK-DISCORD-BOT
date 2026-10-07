import {
  Client,
  GatewayIntentBits,
  Events,
  ChatInputCommandInteraction,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { config } from '../config.js';
import { joinChannel, leaveChannel } from './voice.js';
import { startListening } from './receiver.js';
import { musicPlayer } from '../music/player.js';

export function createClient(): Client {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[BOT] Logged in as ${c.user.tag}`);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // Handle Interactive Buttons (Play/Pause, Skip, Stop, Vol+, Vol-)
    if (interaction.isButton()) {
      try {
        await musicPlayer.handleButtonInteraction(interaction);
      } catch (error) {
        console.error('[BUTTON] Error processing button interaction:', error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    
    const command = interaction as ChatInputCommandInteraction;
    
    try {
      switch (command.commandName) {
        case 'join':
          await handleJoin(command);
          break;
        case 'leave':
          await handleLeave(command);
          break;
        default:
          await command.reply({ content: 'Comando desconocido.', ephemeral: true });
      }
    } catch (error) {
      console.error(`[BOT] Error handling command ${command.commandName}:`, error);
      const reply = command.replied || command.deferred
        ? command.followUp.bind(command)
        : command.reply.bind(command);
      await reply({ content: 'Hubo un error al ejecutar el comando.', ephemeral: true });
    }
  });

  return client;
}

async function handleJoin(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  const voiceChannel = member?.voice.channel;

  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    await interaction.reply({
      content: '❌ Debes estar en un canal de voz para usar este comando.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const connection = joinChannel(voiceChannel);
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    
    if (interaction.channel) {
      musicPlayer.setTextChannel(interaction.channel);
    }
    musicPlayer.setConnection(connection, interaction.channel ?? undefined);
    startListening(connection, interaction.guild!.id, interaction.client);

    await interaction.editReply({
      content: `🎧 Conectado a **${voiceChannel.name}**. ¡Escuchando comandos de voz!\n💡 Di: *"DJ pon [canción]"* o usa los botones del panel interactivo abajo.`,
    });

    await musicPlayer.updateUI();

    console.log(`[BOT] Joined voice channel: ${voiceChannel.name}`);
  } catch (err) {
    console.error('[BOT] Error joining voice channel:', err);
    await interaction.editReply({
      content: '❌ No se pudo conectar al canal de voz a tiempo.',
    });
  }
}

async function handleLeave(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: '❌ Este comando solo funciona en servidores.', ephemeral: true });
    return;
  }

  await musicPlayer.handleCommand({ action: 'stop' });
  const left = leaveChannel(guildId);

  if (left) {
    await interaction.reply({ content: '👋 Desconectado del canal de voz.' });
    console.log('[BOT] Left voice channel');
  } else {
    await interaction.reply({ content: '❌ No estoy en ningún canal de voz.', ephemeral: true });
  }
}

export async function registerCommands(): Promise<void> {
  const commands = [
    new SlashCommandBuilder()
      .setName('join')
      .setDescription('Bot joins your current voice channel and shows the music control panel'),
    new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Bot leaves the voice channel'),
  ];

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  console.log('[BOT] Registering slash commands...');
  
  await rest.put(
    Routes.applicationCommands(config.discord.clientId),
    { body: commands.map(c => c.toJSON()) },
  );

  console.log('[BOT] Slash commands registered successfully.');
}
