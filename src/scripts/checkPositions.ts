import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('ready', async () => {
  const guild = await client.guilds.fetch('1525390373281857546');
  const channels = await guild.channels.fetch();
  const duty = channels.filter(c => c?.parentId === '1525395644192395376').sort((a, b) => a!.rawPosition - b!.rawPosition);

  duty.forEach(c => console.log(`[${c?.rawPosition}] ${c?.name} (${c?.id})`));
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
