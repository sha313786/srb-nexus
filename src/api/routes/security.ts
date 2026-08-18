// Path: src/api/routes/security.ts
import { FastifyInstance } from 'fastify';
import { authenticateApiKey } from '../middleware/auth';
import { db } from '../../core/database';
import { client as discordClient } from '../../discord/client';
import { TextChannel } from 'discord.js';

export async function securityRoutes(fastify: FastifyInstance) {
  // Pre-handler hook to validate API Key for all /api/v1 routes
  fastify.addHook('preHandler', authenticateApiKey);

  // 1. Fetch Guild Security Statistics
  fastify.get('/api/v1/guilds/:guildId/stats', async (request, reply) => {
    const { guildId } = request.params as { guildId: string };

    const { rows: modStats } = await db.query(
      `SELECT action, COUNT(*) as count FROM moderation_logs WHERE guild_id = $1 GROUP BY action`,
      [guildId]
    );

    const { rows: secStats } = await db.query(
      `SELECT event_type, COUNT(*) as count FROM security_events WHERE guild_id = $1 GROUP BY event_type`,
      [guildId]
    );

    return {
      guildId,
      moderationActions: modStats,
      securityEvents: secStats,
    };
  });

  // 2. Fetch Audit Logs
  fastify.get('/api/v1/guilds/:guildId/logs', async (request) => {
    const { guildId } = request.params as { guildId: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);

    const { rows } = await db.query(
      `SELECT id, target_user_id, moderator_user_id, action, reason, created_at 
       FROM moderation_logs 
       WHERE guild_id = $1 
       ORDER BY created_at DESC LIMIT $2`,
      [guildId, limit]
    );

    return { guildId, logs: rows };
  });

  // 3. Remote Trigger Emergency Lockdown
  fastify.post('/api/v1/guilds/:guildId/lockdown', async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const body = request.body as { channelId: string; lock: boolean };

    if (!body.channelId) {
      return reply.status(400).send({ error: 'Bad Request', message: 'channelId is required' });
    }

    const guild = await discordClient.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return reply.status(404).send({ error: 'Not Found', message: 'Guild not found or bot lacks access' });
    }

    const channel = await guild.channels.fetch(body.channelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Text channel not found' });
    }

    const everyoneRole = guild.roles.everyone;

    if (body.lock) {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false });
    } else {
      await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: null });
    }

    return {
      success: true,
      channelId: body.channelId,
      state: body.lock ? 'LOCKED' : 'UNLOCKED',
      executedAt: new Date().toISOString(),
    };
  });
}