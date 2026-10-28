import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', () => {
  console.log('Bot User Tag:', client.user?.tag);
  console.log('Bot User ID (Application ID):', client.user?.id);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
