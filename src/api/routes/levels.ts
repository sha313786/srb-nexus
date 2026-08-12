import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function levelsRoutes(fastify: FastifyInstance) {
  fastify.post('/api/guilds/:id/modules/levels', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    await db.query(
      `INSERT INTO module_levels (guild_id, level_channel_id, xp_rate, enabled)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (guild_id) DO UPDATE SET
         level_channel_id = EXCLUDED.level_channel_id,
         xp_rate = EXCLUDED.xp_rate,
         enabled = EXCLUDED.enabled`,
      [id, b.level_channel_id, b.xp_rate ?? 1.0, b.enabled ?? true]
    );

    return reply.send({ success: true, message: 'Leveling module updated' });
  });
}