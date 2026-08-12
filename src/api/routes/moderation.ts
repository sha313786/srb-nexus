import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function moderationRoutes(fastify: FastifyInstance) {
  fastify.post('/api/guilds/:id/modules/moderation', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    await db.query(
      `INSERT INTO module_moderation (guild_id, log_channel_id, mute_role_id, anti_links, anti_spam)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guild_id) DO UPDATE SET
         log_channel_id = EXCLUDED.log_channel_id,
         mute_role_id = EXCLUDED.mute_role_id,
         anti_links = EXCLUDED.anti_links,
         anti_spam = EXCLUDED.anti_spam`,
      [id, b.log_channel_id, b.mute_role_id, b.anti_links ?? false, b.anti_spam ?? false]
    );

    return reply.send({ success: true, message: 'Moderation module updated' });
  });
}