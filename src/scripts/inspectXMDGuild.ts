import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const GUILD_ID = '1525390373281857546';

client.on('ready', async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    console.log('Fetched Guild:', guild.name);

    const channels = await guild.channels.fetch();
    console.log('\n--- CHANNELS ---');
    for (const [id, ch] of channels) {
      if (!ch) continue;
      if (ch.type === ChannelType.GuildCategory) {
        console.log(`[CATEGORY] ${ch.name} (ID: ${id})`);
      } else {
        console.log(`  [${ch.type}] ${ch.name} (Parent: ${ch.parentId || 'None'}) (ID: ${id})`);
      }
    }

    const roles = await guild.roles.fetch();
    console.log('\n--- ROLES ---');
    for (const [id, r] of roles) {
      console.log(`Role: ${r.name} (ID: ${id})`);
    }

    const me = await guild.members.fetchMe();
    console.log('\nBot Permissions:', me.permissions.toArray());

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
