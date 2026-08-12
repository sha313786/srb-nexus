import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function economyRoutes(fastify: FastifyInstance) {
  // GET /api/guilds/:id/modules/economy
  fastify.get('/api/guilds/:id/modules/economy', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    try {
      const res = await db.query('SELECT * FROM module_economy WHERE guild_id = $1', [id]);
      return reply.send({
        settings: res.rows[0] || {
          guild_id: id,
          currency_symbol: '🪙',
          daily_reward: 100,
          enabled: true,
        },
      });
    } catch (err) {
      req.log.error({ err }, 'Failed to fetch economy settings');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/guilds/:id/modules/economy
  fastify.post('/api/guilds/:id/modules/economy', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    try {
      await db.query(
        `INSERT INTO module_economy (guild_id, currency_symbol, daily_reward, enabled)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) DO UPDATE SET
           currency_symbol = EXCLUDED.currency_symbol,
           daily_reward = EXCLUDED.daily_reward,
           enabled = EXCLUDED.enabled`,
        [id, b.currency_symbol || '🪙', b.daily_reward ?? 100, b.enabled ?? true]
      );
      return reply.send({ success: true, message: 'Economy settings saved' });
    } catch (err) {
      req.log.error({ err }, 'Failed to save economy settings');
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });
}