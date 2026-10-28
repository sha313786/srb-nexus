import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const GUILD_ID = '1525390373281857546';
const DUTY_CATEGORY_ID = '1525395644192395376';

client.on('ready', async () => {
  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    const channels = await guild.channels.fetch();
    const dutyChannels = channels.filter(c => c?.parentId === DUTY_CATEGORY_ID);

    console.log(`Current channels in DUTY SYSTEM (${dutyChannels.size}):`);
    dutyChannels.forEach(c => console.log(` - ${c?.name} (${c?.id})`));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});

client.login(process.env.DISCORD_TOKEN);
