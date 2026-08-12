import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { logger } from '../core/logger';
import { authRoutes } from './routes/auth';
import { guildRoutes } from './routes/guilds';
import { healthRoutes } from './routes/health';

export const apiServer: FastifyInstance = Fastify({
  logger: false,
});

// Resolve correct public folder path whether running TS source or compiled JS in dist/
const publicPath = fs.existsSync(path.join(__dirname, '../../public'))
  ? path.join(__dirname, '../../public')
  : path.join(__dirname, '../public');

// Register Static Files Plugin
apiServer.register(fastifyStatic, {
  root: publicPath,
  prefix: '/',
});

// Register Cookie and JWT Plugins
apiServer.register(fastifyCookie);
apiServer.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'fallback_secret_key_change_in_production',
  cookie: {
    cookieName: 'nexus_token',
    signed: false,
  },
});

// Serve HTML Views
apiServer.get('/', async (req, reply) => {
  return reply.sendFile('index.html');
});

apiServer.get('/dashboard', async (req, reply) => {
  return reply.sendFile('dashboard.html');
});

// Register API Routes
apiServer.register(healthRoutes);
apiServer.register(authRoutes);
apiServer.register(guildRoutes);

export async function startServer(port: number = 10000): Promise<FastifyInstance> {
  try {
    await apiServer.listen({ port, host: '0.0.0.0' });
    logger.info(`Fastify REST API server running on http://0.0.0.0:${port}`);
    return apiServer;
  } catch (err) {
    logger.error({ err }, 'Failed to start Fastify server');
    throw err;
  }
}