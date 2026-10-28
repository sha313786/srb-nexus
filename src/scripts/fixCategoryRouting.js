const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require('discord.js');
const { Client: PgClient } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const GUILD_ID = '1525065834572021851';
const SUPPORT_CENTER_ID = '1525114945568768131';

async function main() {
  console.log('🔄 Fixing category routing once and for all...');

  // 1. Fix interactionCreate.ts
  const filePath = path.join(__dirname, '../discord/events/interactionCreate.ts');
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');

  // Replace getTicketCategoryId function
  const oldFuncRegex = /function getTicketCategoryId\([\s\S]*?return fallbackCat \? fallbackCat\.id : undefined;\s*\}/;
  const newFunc = `function getTicketCategoryId(guild: any, configuredCatId?: string): string | undefined {
  const SUPPORT_CENTER_ID = '1525114945568768131';

  // 1. If guild is SRB Studio, always prioritize 🎫 SUPPORT CENTER
  if (guild.id === '1525065834572021851' && guild.channels.cache.has(SUPPORT_CENTER_ID)) {
    return SUPPORT_CENTER_ID;
  }

  // 2. If configuredCatId is valid and NOT UPI
  if (configuredCatId && guild.channels.cache.has(configuredCatId)) {
    const cat = guild.channels.cache.get(configuredCatId);
    if (cat && !/upi/i.test(cat.name)) {
      return configuredCatId;
    }
  }

  // 3. Search for Support Center or Tickets (excluding UPI)
  const supportCenter = guild.channels.cache.find(
    (c: any) =>
      c.type === ChannelType.GuildCategory &&
      !/upi/i.test(c.name) &&
      (/support center/i.test(c.name) || c.id === SUPPORT_CENTER_ID || /ticket/i.test(c.name))
  );
  if (supportCenter) return supportCenter.id;

  // 4. Fallback to any category with 'support' that is NOT UPI
  const fallbackCat = guild.channels.cache.find(
    (c: any) =>
      c.type === ChannelType.GuildCategory &&
      !/upi/i.test(c.name) &&
      /support/i.test(c.name)
  );
  return fallbackCat ? fallbackCat.id : undefined;
}`;

  content = content.replace(oldFuncRegex, newFunc);

  // Remove the if (false && configuredCatId) { ... } else { ... } blocks
  const badBlockRegex = /let targetCategoryId = getTicketCategoryId\(guild, configuredCatId\);\s*if \(false && configuredCatId\) \{[\s\S]*?db\.query\(`UPDATE guild_settings SET category_id = \$1 WHERE guild_id = \$2`, \[found\.id, guild\.id\]\)\.catch\(\(\) => \{\}\);\s*\}\s*\}/g;
  content = content.replace(
    badBlockRegex,
    'const targetCategoryId = getTicketCategoryId(guild, configuredCatId);'
  );

  if (isCrlf) {
    content = content.replace(/\n/g, '\r\n');
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Cleaned up interactionCreate.ts');

  // 2. Update Database
  const pg = new PgClient({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  await pg.query('UPDATE guild_settings SET category_id = $1 WHERE guild_id = $2', [
    SUPPORT_CENTER_ID,
    GUILD_ID,
  ]);
  console.log('✅ Updated database category_id to SUPPORT CENTER');
  await pg.end();

  // 3. Move misplaced Discord channels
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN);
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  const upiCatId = '1560334088676581606';
  const misplaced = guild.channels.cache.filter(
    (c) =>
      c.parentId === upiCatId &&
      (c.name.startsWith('quote-') ||
        c.name.startsWith('ticket-') ||
        c.name.startsWith('report-') ||
        c.name.startsWith('inquiry-'))
  );

  for (const [_, ch] of misplaced) {
    await ch.setParent(SUPPORT_CENTER_ID, { lockPermissions: false });
    console.log(`✅ Moved #${ch.name} to 🎫 SUPPORT CENTER`);
  }

  console.log('🎉 Done fixing routing and channels!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
