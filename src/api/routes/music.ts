import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function musicRoutes(fastify: FastifyInstance) {
  // GET /api/guilds/:id/modules/music
  fastify.get('/api/guilds/:id/modules/music', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const res = await db.query('SELECT * FROM module_music WHERE guild_id = $1', [id]);
      return reply.send({
        settings: res.rows[0] || {
          guild_id: id,
          dj_role_id: null,
          default_volume: 80,
          max_queue_length: 100,
          enabled: true,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to fetch music settings');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/guilds/:id/modules/music
  fastify.post('/api/guilds/:id/modules/music', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    try {
      await db.query(
        `INSERT INTO module_music (guild_id, dj_role_id, default_volume, max_queue_length, enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id) DO UPDATE SET
           dj_role_id = EXCLUDED.dj_role_id,
           default_volume = EXCLUDED.default_volume,
           max_queue_length = EXCLUDED.max_queue_length,
           enabled = EXCLUDED.enabled`,
        [id, b.dj_role_id || null, b.default_volume ?? 80, b.max_queue_length ?? 100, b.enabled ?? true]
      );
      return reply.send({ success: true, message: 'Music settings saved' });
    } catch (err) {
      req.log.error({ err }, 'Failed to save music settings');
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });
}