import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
  const guild = await client.guilds.fetch('1525390373281857546');
  const channel = await guild.channels.fetch('1564381545089736774');
  if (channel && 'setPosition' in channel) {
    await channel.setPosition(18);
    console.log('Channel position set to 18.');
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
