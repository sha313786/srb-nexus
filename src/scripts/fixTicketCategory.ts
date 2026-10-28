import { Client, GatewayIntentBits } from 'discord.js';
import { Client as PgClient } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = '1525065834572021851';
const SUPPORT_CENTER_CAT_ID = '1525114945568768131';

async function main() {
  console.log('🔄 Fixing Ticket Category in DB and moving any misplaced ticket channels...');

  // 1. Update Database
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query(
    'UPDATE guild_settings SET category_id = $1 WHERE guild_id = $2',
    [SUPPORT_CENTER_CAT_ID, GUILD_ID]
  );
  console.log('✅ Updated guild_settings category_id to SUPPORT CENTER (1525114945568768131)');
  await pg.end();

  // 2. Discord Channel Move
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // Find any ticket channels currently under UPI ALERTS (1560334088676581606)
  const upiCatId = '1560334088676581606';
  const misplacedChannels = guild.channels.cache.filter(
    (c: any) =>
      c.parentId === upiCatId &&
      (c.name.startsWith('quote-') || c.name.startsWith('ticket-') || c.name.startsWith('report-') || c.name.startsWith('inquiry-'))
  );

  console.log(`Found ${misplacedChannels.size} misplaced ticket channels in UPI Alerts.`);
  for (const [_, chan] of misplacedChannels) {
    await (chan as any).setParent(SUPPORT_CENTER_CAT_ID, { lockPermissions: false });
    console.log(`✅ Moved #${chan.name} (${chan.id}) to 🎫 SUPPORT CENTER`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
