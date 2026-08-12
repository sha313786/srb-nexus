import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function ticketRoutes(fastify: FastifyInstance) {
  // GET /api/guilds/:id/modules/tickets
  fastify.get('/api/guilds/:id/modules/tickets', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const res = await db.query('SELECT * FROM module_tickets WHERE guild_id = $1', [id]);
      return reply.send({
        settings: res.rows[0] || {
          guild_id: id,
          category_id: null,
          transcript_channel_id: null,
          support_role_id: null,
          enabled: true,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to fetch ticket settings');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/guilds/:id/modules/tickets
  fastify.post('/api/guilds/:id/modules/tickets', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    try {
      await db.query(
        `INSERT INTO module_tickets (guild_id, category_id, transcript_channel_id, support_role_id, enabled)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (guild_id) DO UPDATE SET
           category_id = EXCLUDED.category_id,
           transcript_channel_id = EXCLUDED.transcript_channel_id,
           support_role_id = EXCLUDED.support_role_id,
           enabled = EXCLUDED.enabled`,
        [id, b.category_id || null, b.transcript_channel_id || null, b.support_role_id || null, b.enabled ?? true]
      );
      return reply.send({ success: true, message: 'Ticket settings saved' });
    } catch (err) {
      req.log.error({ err }, 'Failed to save ticket settings');
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });
}