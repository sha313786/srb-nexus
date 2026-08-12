import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import dotenv from 'dotenv';
import { Client, GatewayIntentBits } from 'discord.js';

import { db } from './core/database';
import { authRoutes } from './api/routes/auth';
import { guildRoutes } from './api/routes/guilds';

dotenv.config();

const app = Fastify({ logger: true });

// 1. Initialize Discord Bot Client
export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

bot.once('ready', () => {
  app.log.info(`[BOT] Discord bot online and logged in as ${bot.user?.tag}`);
});

async function start() {
  try {
    // 2. Register Plugins
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

    // 3. Register Routes
    await app.register(authRoutes);
    await app.register(guildRoutes);

    // Serve Dashboard HTML
    app.get('/dashboard', async (request, reply) => {
      return reply.sendFile('dashboard.html');
    });

    // 4. Connect and Test Database Connection
    if (typeof (db as any).connect === 'function') {
      await (db as any).connect();
    }
    await db.query('SELECT 1');
    app.log.info('Database connection established successfully');

    // 5. Start Fastify Server
    const port = Number(process.env.PORT) || 10000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Fastify REST API server running on http://0.0.0.0:${port}`);

    // 6. Log in to Discord Gateway
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