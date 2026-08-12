import { Client, GatewayIntentBits } from 'discord.js';
import { fastify } from './api'; // adjust to your fastify setup path
import { db } from './core/database';

// 1. Initialize Discord Client with required Intents
export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// 2. Bot Event Handlers
bot.once('ready', () => {
  console.log(`[BOT] Logged in and active as ${bot.user?.tag}!`);
});

async function startServer() {
  try {
    // Connect DB & Start REST API
    await fastify.listen({ port: Number(process.env.PORT) || 10000, host: '0.0.0.0' });
    console.log('[API] Fastify REST API running');

    // Start Discord Bot
    if (process.env.DISCORD_TOKEN) {
      await bot.login(process.env.DISCORD_TOKEN);
    } else {
      console.error('[BOT ERROR] DISCORD_TOKEN is missing in environment variables!');
    }
  } catch (err) {
    console.error('Failed to start engine:', err);
    process.exit(1);
  }
}

startServer();