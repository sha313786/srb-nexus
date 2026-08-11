import { FastifyInstance } from 'fastify';
import { discordService } from '../../discord/client';
import { db } from '../../core/database';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => {
    const isDiscordConnected = discordService.client.isReady();
    const isDbConnected = db.isConnected();

    const status = isDiscordConnected && isDbConnected ? 'HEALTHY' : 'DEGRADED';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        discord: isDiscordConnected ? 'UP' : 'DOWN',
        database: isDbConnected ? 'UP' : 'DOWN',
        pingMs: discordService.client.ws.ping,
      },
    };
  });
}