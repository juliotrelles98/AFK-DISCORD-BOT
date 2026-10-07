import { config } from './config.js';
import { registerCommands } from './discord/client.js';

async function main() {
  if (!config.discord.token || !config.discord.clientId) {
    console.error('❌ DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env');
    process.exit(1);
  }

  try {
    await registerCommands();
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
    process.exit(1);
  }
}

main();
