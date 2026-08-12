import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function welcomeRoutes(fastify: FastifyInstance) {
  // GET /api/guilds/:id/modules/welcome
  fastify.get('/api/guilds/:id/modules/welcome', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const res = await db.query('SELECT * FROM module_welcome WHERE guild_id = $1', [id]);
    
    return reply.send({
      settings: res.rows[0] || {
        guild_id: id,
        welcome_channel_id: null,
        welcome_message: 'Welcome {user} to {server}!',
        leave_channel_id: null,
        leave_message: '{username} has left the server.',
        autorole_id: null,
        enabled: true
      }
    });
  });

  // POST /api/guilds/:id/modules/welcome
  fastify.post('/api/guilds/:id/modules/welcome', async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const b = req.body as any;

    await db.query(
      `INSERT INTO module_welcome (guild_id, welcome_channel_id, welcome_message, leave_channel_id, leave_message, autorole_id, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (guild_id) DO UPDATE SET
         welcome_channel_id = EXCLUDED.welcome_channel_id,
         welcome_message = EXCLUDED.welcome_message,
         leave_channel_id = EXCLUDED.leave_channel_id,
         leave_message = EXCLUDED.leave_message,
         autorole_id = EXCLUDED.autorole_id,
         enabled = EXCLUDED.enabled`,
      [id, b.welcome_channel_id, b.welcome_message, b.leave_channel_id, b.leave_message, b.autorole_id, b.enabled ?? true]
    );

    return reply.send({ success: true, message: 'Welcome module updated' });
  });
}