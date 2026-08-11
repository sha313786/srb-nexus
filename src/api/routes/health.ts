import { FastifyInstance } from 'fastify';
import { db } from '../../core/database';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (request, reply) => {
    const isDbConnected = db.isConnected;

    const healthStatus = {
      status: isDbConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: isDbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    };

    const statusCode = isDbConnected ? 200 : 503;
    return reply.status(statusCode).send(healthStatus);
  });
}