import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { db } from '../../core/database';

interface AuthUserPayload {
  id: string;
  username: string;
  avatar: string | null;
  accessToken: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
  permissions_new?: string;
}

interface GuildSettingRow {
  guild_id: string;
}

const ADMIN_BIT = BigInt(0x8);
const MANAGE_GUILD_BIT = BigInt(0x20);

export async function guildRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await (request as any).jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized access' });
    }
  });

  fastify.get('/api/guilds', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;

    if (!user || !user.accessToken) {
      reply.clearCookie('nexus_token', { path: '/' });
      return reply.status(401).send({ error: 'Invalid or missing authentication token' });
    }

    // 1. Fetch guilds from Discord API
    let discordGuilds: DiscordGuild[] = [];
    try {
      const response = await axios.get<DiscordGuild[]>('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });
      discordGuilds = response.data || [];
    } catch (err: any) {
      if (err.response?.status === 401) {
        reply.clearCookie('nexus_token', { path: '/' });
        return reply.status(401).send({ error: 'Discord token expired, please re-login' });
      }
      return reply.status(500).send({
        error: 'Discord API Error',
        message: err.response?.data?.message || err.message,
      });
    }

    // 2. Filter down to servers where user has management rights
    const manageableGuilds = discordGuilds.filter((guild) => {
      if (guild.owner) return true;
      const permStr = guild.permissions_new || guild.permissions;
      if (!permStr) return false;
      try {
        const perms = BigInt(permStr);
        return (perms & ADMIN_BIT) !== BigInt(0) || (perms & MANAGE_GUILD_BIT) !== BigInt(0);
      } catch {
        return false;
      }
    });

    // 3. Fetch configured guild IDs from Database (with safe fallback)
    const botGuildIds = new Set<string>();
    try {
      const dbResult = await db.query<GuildSettingRow>('SELECT guild_id FROM guild_settings');
      if (dbResult && dbResult.rows) {
        dbResult.rows.forEach((row: GuildSettingRow) => botGuildIds.add(row.guild_id));
      }
    } catch (dbErr: any) {
      request.log.warn({ dbErr }, 'Database query failed in /api/guilds, defaulting to empty set');
    }

    // 4. Map final result array cleanly
    const result = manageableGuilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
      hasBot: botGuildIds.has(guild.id),
    }));

    return reply.send({ guilds: result });
  });
}