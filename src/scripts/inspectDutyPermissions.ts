import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const GUILD_ID = '1525390373281857546';

client.on('ready', async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const category = await guild.channels.fetch('1525395644192395376');
    console.log('Category:', category?.name);

    const channels = await guild.channels.fetch();
    const dutyChannels = channels.filter((c) => c?.parentId === '1525395644192395376');

    for (const [id, ch] of dutyChannels) {
      if (!ch) continue;
      console.log(`\nChannel: ${ch.name} (${id})`);
      ch.permissionOverwrites.cache.forEach((po) => {
        const target = po.type === 0 ? guild.roles.cache.get(po.id)?.name : 'Member';
        console.log(`  Overwrite: ${target || po.id} Allow: ${po.allow.toArray().join(',')} Deny: ${po.deny.toArray().join(',')}`);
      });
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
