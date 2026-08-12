import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Guild, Events, GuildMember, Message } from 'discord.js';

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

// 3. Welcome Message & Autorole Event
bot.on(Events.GuildMemberAdd, async (member: GuildMember) => {
  try {
    const res = await db.query(
      'SELECT welcome_channel_id, welcome_message, autorole_id FROM guild_settings WHERE guild_id = $1',
      [member.guild.id]
    );

    if (res.rows.length === 0) return;
    const { welcome_channel_id, welcome_message, autorole_id } = res.rows[0];

    // Auto-Role Assignment
    if (autorole_id) {
      const role = member.guild.roles.cache.get(autorole_id);
      if (role) {
        await member.roles.add(role).catch((err) =>
          app.log.error({ err }, `[BOT] Failed to assign autorole in guild ${member.guild.id}`)
        );
      }
    }

    // Welcome Message Delivery (with Fetch Fallback)
    if (welcome_channel_id && welcome_message) {
      // Try cache first, fallback to API fetch if channel isn't cached
      let channel = member.guild.channels.cache.get(welcome_channel_id);
      if (!channel) {
        channel = await member.guild.channels.fetch(welcome_channel_id).catch(() => undefined);
      }

      if (channel && channel.isTextBased()) {
        const formattedMsg = welcome_message.replace('{user}', `<@${member.id}>`);
        await channel.send(formattedMsg).catch((err) =>
          app.log.error({ err }, `[BOT] Failed to send welcome message in guild ${member.guild.id}`)
        );
      } else {
        app.log.warn(`[BOT] Welcome channel ${welcome_channel_id} not found or is not text-based.`);
      }
    }
  } catch (err) {
    app.log.error({ err }, '[BOT] Error in GuildMemberAdd event handler');
  }
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

    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('dashboard.html');
    });

    if (typeof (db as any).connect === 'function') {
      await (db as any).connect();
    }

    // Ensure database table and columns exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id VARCHAR(32) PRIMARY KEY,
        prefix VARCHAR(10) DEFAULT '!',
        welcome_channel_id VARCHAR(32),
        welcome_message TEXT,
        autorole_id VARCHAR(32),
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
      ADD COLUMN IF NOT EXISTS autorole_id VARCHAR(32),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    `);

    app.log.info('Database connection established & tables initialized');

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