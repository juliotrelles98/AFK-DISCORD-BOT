import { config } from './config.js';
import { createClient } from './discord/client.js';
import { checkWhisperHealth } from './speech/whisper.js';

async function main() {
  console.log('🎧 DJ Voice Bot - Starting...');
  console.log('');

  // Validate configuration
  if (!config.discord.token) {
    console.error('❌ DISCORD_TOKEN is not set. Copy .env.example to .env and fill in your token.');
    process.exit(1);
  }

  if (!config.discord.clientId) {
    console.error('❌ DISCORD_CLIENT_ID is not set. Copy .env.example to .env and fill in your client ID.');
    process.exit(1);
  }

  // Check Whisper server
  console.log(`[STARTUP] Checking Whisper server at ${config.whisper.url}...`);
  const whisperHealthy = await checkWhisperHealth();
  
  if (whisperHealthy) {
    console.log('[STARTUP] ✅ Whisper server is running');
  } else {
    console.warn('[STARTUP] ⚠️ Whisper server is not available. Voice transcription will fail.');
    console.warn(`[STARTUP] Start it with: cd python && python3 whisper_server.py`);
    console.warn('[STARTUP] Continuing anyway...');
  }

  console.log('');

  // Create and start Discord client
  const client = createClient();

  try {
    await client.login(config.discord.token);
  } catch (error) {
    console.error('❌ Failed to login to Discord:', error);
    process.exit(1);
  }
}

main();
