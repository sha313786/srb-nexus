import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../core/database';

export async function authenticateApiKey(request: FastifyRequest, reply: FastifyReply) {
  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing X-API-KEY header' });
  }

  try {
    const { rows } = await db.query(
      `SELECT guild_id FROM guild_security_config WHERE api_key = $1`,
      [apiKey]
    );

    if (rows.length === 0) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Invalid API Key' });
    }

    // Attach guild metadata to request context
    (request as any).authenticatedGuildId = rows[0].guild_id;
  } catch (err) {
    return reply.status(500).send({ error: 'Internal Server Error', message: 'Authentication failed' });
  }
}