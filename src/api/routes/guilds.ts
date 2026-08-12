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
      return reply.status(401).send({ error: 'Invalid or missing authentication token' });
    }

    try {
      const response = await axios.get<DiscordGuild[]>('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      const allGuilds = response.data || [];

      // Try filtering by permissions
      let manageableGuilds = allGuilds.filter((guild: DiscordGuild) => {
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

      // FALLBACK: If bitwise filter returned nothing, show ALL user guilds so the UI isn't blank
      if (manageableGuilds.length === 0 && allGuilds.length > 0) {
        manageableGuilds = allGuilds;
      }

      let botGuildIds = new Set<string>();
      try {
        const { rows } = await db.query<GuildSettingRow>('SELECT guild_id FROM guild_settings');
        if (rows) {
          botGuildIds = new Set(rows.map((row: GuildSettingRow) => row.guild_id));
        }
      } catch (dbErr) {
        request.log.warn(dbErr, 'Could not query guild_settings, defaulting to empty set');
      }

      const result = manageableGuilds.map((guild: DiscordGuild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        hasBot: botGuildIds.has(guild.id),
      }));

      return reply.send({ guilds: result });
    } catch (err: any) {
      const errorDetails = err.response?.data || err.message;
      request.log.error({ errorDetails }, 'Failed to fetch user guilds from Discord');
      return reply.status(500).send({ 
        error: 'Failed to retrieve server list', 
        details: errorDetails 
      });
    }
  });
}