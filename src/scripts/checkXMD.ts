import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
  console.log('LOGGED_IN:', client.user?.tag);
  client.guilds.cache.forEach((guild) => {
    console.log('GUILD_INFO:', guild.name, guild.id);
  });
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch((e) => {
  console.error('LOGIN_ERROR:', e.message);
  process.exit(1);
});
