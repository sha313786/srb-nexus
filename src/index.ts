import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits, Guild } from 'discord.js';

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

// 1. Ready listener: Syncs active guilds into DB when bot logs in
bot.once('ready', async () => {
  app.log.info(`[BOT] Discord bot online and logged in as ${bot.user?.tag}`);

  try {
    const activeGuilds = bot.guilds.cache.map((g) => g.id);
    for (const guildId of activeGuilds) {
      await db.query(
        `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
        [guildId]
      );
    }
    app.log.info(`[BOT] Synced ${activeGuilds.length} joined guilds into database.`);
  } catch (err) {
    app.log.error({ err }, '[BOT] Failed to sync joined guilds to database');
  }
});

// 2. Guild join listener: Registers new guilds when bot is invited
bot.on('guildCreate', async (guild: Guild) => {
  try {
    await db.query(
      `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
      [guild.id]
    );
    app.log.info(`[BOT] Registered server in database: ${guild.name} (${guild.id})`);
  } catch (err) {
    app.log.error({ err }, `[BOT] Failed to register guild ${guild.id} on join`);
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

    await app.register(authRoutes);
    await app.register(guildRoutes);

    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('dashboard.html');
    });

    if (typeof (db as any).connect === 'function') {
      await (db as any).connect();
    }
    await db.query('SELECT 1');
    app.log.info('Database connection established successfully');

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