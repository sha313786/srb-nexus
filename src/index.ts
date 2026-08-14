import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Guild, Events, GuildMember, Message, EmbedBuilder } from 'discord.js';

import { db } from './core/database';
import { authRoutes } from './api/routes/auth';
import { guildRoutes } from './api/routes/guilds';

dotenv.config();

const app = Fastify({ logger: true });

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

// Helper function to insert/sync guild
async function registerGuild(guildId: string, guildName?: string) {
  await db.query(
    `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
    [guildId]
  );
  if (guildName) {
    app.log.info(`[BOT] Registered server in database: ${guildName} (${guildId})`);
  }
}

// 1. Ready listener
bot.once(Events.ClientReady, async () => {
  app.log.info(`[BOT] Discord bot online and logged in as ${bot.user?.tag}`);

  try {
    const activeGuilds = bot.guilds.cache.map((g) => g.id);
    for (const guildId of activeGuilds) {
      await registerGuild(guildId);
    }
    app.log.info(`[BOT] Synced ${activeGuilds.length} joined guilds into database.`);
  } catch (err) {
    app.log.error({ err }, '[BOT] Failed to sync joined guilds to database');
  }
});

// 2. Guild join listener
bot.on(Events.GuildCreate, async (guild: Guild) => {
  try {
    await registerGuild(guild.id, guild.name);
  } catch (err) {
    app.log.error({ err }, `[BOT] Failed to register guild ${guild.id} on join`);
  }
});

// 3. Welcome Message & Autorole Event (With Rich Embed Card)
bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  console.log(`\n========================================`);
  app.log.info(`[BOT] NEW MEMBER JOIN DETECTED: ${member.user.tag} (${member.id}) in guild ${member.guild.name} (${member.guild.id})`);

  try {
    const res = await db.query(
      'SELECT welcome_channel_id, welcome_message, autorole_id FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    );

    app.log.info({ dbResult: res.rows }, '[BOT] Raw DB query result on join');

    if (res.rows.length === 0) {
      app.log.warn(`[BOT] ABORTED: No row found in database for guild_id ${member.guild.id}`);
      return;
    }

    const { welcome_channel_id, welcome_message, autorole_id } = res.rows[0];

    app.log.info(`[BOT] DB Config Values -> Channel: "${welcome_channel_id}", Message: "${welcome_message}", Role: "${autorole_id}"`);

    // Auto-Role Assignment
    if (autorole_id) {
      const cleanRoleId = String(autorole_id).replace(/[<#@!&>]/g, '').trim();
      const role = member.guild.roles.cache.get(cleanRoleId);
      if (role) {
        await member.roles.add(role)
          .then(() => app.log.info(`[BOT] SUCCESS: Assigned role ${role.name}`))
          .catch((err) => app.log.error({ err }, `[BOT] ERROR: Failed to assign role`));
      } else {
        app.log.warn(`[BOT] WARN: Role ID ${cleanRoleId} not found in guild cache`);
      }
    }

    // Welcome Embed Delivery
    if (welcome_channel_id) {
      const cleanChannelId = String(welcome_channel_id).replace(/[<#@!&>]/g, '').trim();
      
      let channel = member.guild.channels.cache.get(cleanChannelId);
      if (!channel) {
        app.log.info(`[BOT] Channel ${cleanChannelId} missing from cache. Fetching via API...`);
        channel = await member.guild.channels.fetch(cleanChannelId).catch((err) => {
          app.log.error({ err }, `[BOT] ERROR: Could not fetch channel ${cleanChannelId}`);
          return null;
        }) as any;
      }

      if (channel && channel.isTextBased()) {
        const customMsg = welcome_message || 'Welcome to {server}, {user}!';
        const formattedMsg = customMsg
          .replace('{user}', `<@${member.id}>`)
          .replace('{server}', member.guild.name);

        const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);

        const welcomeEmbed = new EmbedBuilder()
          .setColor('#E74C3C')
          .setAuthor({
            name: member.guild.name,
            iconURL: member.guild.iconURL() || undefined,
          })
          .setTitle(`Welcome to ${member.guild.name}`)
          .setDescription(`${formattedMsg} 🎉\n\nWe're glad to have you here.\nPlease read the rules and enjoy your stay.`)
          .addFields(
            { name: '👤 Member', value: member.user.username, inline: true },
            { name: '👥 Count', value: `${member.guild.memberCount}`, inline: true },
            { name: '📅 Created', value: `<t:${createdTimestamp}:R>`, inline: true }
          )
          .setImage(
  `https://api.popcat.xyz/welcomecard?background=https://cdn.discordapp.com/attachments/1000000000000000000/1000000000000000000/bg.png&avatar=${encodeURIComponent(
    member.user.displayAvatarURL({ extension: 'png', size: 256 })
  )}&text1=${encodeURIComponent(member.user.username)}&text2=${encodeURIComponent(
    `WELCOME TO ${member.guild.name.toUpperCase()}`
  )}&text3=${encodeURIComponent(`Member #${member.guild.memberCount}`)}`
)
          .setTimestamp();

        await channel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed] })
          .then(() => app.log.info(`[BOT] SUCCESS: Sent welcome embed to channel ${cleanChannelId}`))
          .catch((err) => app.log.error({ err }, `[BOT] ERROR: Discord API rejected message send`));
      } else {
        app.log.warn(`[BOT] WARN: Channel ${cleanChannelId} is not text-based or null`);
      }
    } else {
      app.log.warn(`[BOT] WARN: welcome_channel_id is null/empty in DB`);
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] UNHANDLED ERROR in GuildMemberAdd');
  }
  console.log(`========================================\n`);
});

// 4. Custom Prefix Command Handling
bot.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot || !message.guild) return;

  try {
    const res = await db.query(
      'SELECT prefix FROM guild_settings WHERE guild_id = $1',
      [message.guild.id]
    );

    const prefix = res.rows[0]?.prefix || '!';

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (commandName === 'ping') {
      await message.reply('Pong!');
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] Error in MessageCreate event handler');
  }
});

async function start() {
  try {
    await app.register(fastifyCookie);
    await app.register(fastifyJwt, {
      secret: process.env.JWT_SECRET || 'nexus-super-secret-key-change-in-prod',
      cookie: {
        cookieName: 'nexus_token',
        signed: false,
      },
    });

    await app.register(fastifyStatic, {
      root: path.join(__dirname, '../public'),
      prefix: '/',
    });

    // Health check endpoint for Render
    app.get('/health', async () => {
      return { status: 'ok' };
    });

    await app.register(authRoutes);
    await app.register(guildRoutes);

    // Root route fallback -> serves index.html
    app.get('/', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    // /dashboard fallback -> serves index.html
    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('index.html');
    });

    if (typeof (db as any).connect === 'function') {
      await (db as any).connect();
    }

    // Ensure database table and columns exist for all modules
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id VARCHAR(32) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT '!',
        welcome_channel_id VARCHAR(32),
        welcome_message TEXT,
        leave_channel_id VARCHAR(32),
        autorole_id VARCHAR(32),
        log_channel_id VARCHAR(32),
        anti_links BOOLEAN DEFAULT FALSE,
        anti_spam BOOLEAN DEFAULT FALSE,
        level_channel_id VARCHAR(32),
        xp_rate NUMERIC DEFAULT 1.0,
        dj_role_id VARCHAR(32),
        default_volume INTEGER DEFAULT 80,
        currency_symbol VARCHAR(10) DEFAULT '🪙',
        daily_reward INTEGER DEFAULT 100,
        transcript_channel_id VARCHAR(32),
        support_role_id VARCHAR(32),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Safety migrations for existing database setups
    await db.query(`
      ALTER TABLE guild_settings 
      ADD COLUMN IF NOT EXISTS prefix VARCHAR(10) DEFAULT '!',
      ADD COLUMN IF NOT EXISTS welcome_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS welcome_message TEXT,
      ADD COLUMN IF NOT EXISTS leave_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS autorole_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS log_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS anti_links BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS anti_spam BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS level_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS xp_rate NUMERIC DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS dj_role_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS default_volume INTEGER DEFAULT 80,
      ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) DEFAULT '🪙',
      ADD COLUMN IF NOT EXISTS daily_reward INTEGER DEFAULT 100,
      ADD COLUMN IF NOT EXISTS transcript_channel_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS support_role_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    app.log.info('Database connection established & tables initialized with module columns');

    const port = Number(process.env.PORT) || 10000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Fastify REST API server running on http://0.0.0.0:${port}`);

    if (process.env.DISCORD_TOKEN) {
      await bot.login(process.env.DISCORD_TOKEN);
    } else {
      app.log.warn('DISCORD_TOKEN is missing in environment variables. Bot client offline.');
    }
  } catch (err) {
    app.log.error(err, 'Failed to start SRB NEXUS engine');
    process.exit(1);
  }
}

start();