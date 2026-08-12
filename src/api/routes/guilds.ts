import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { db } from '../../core/database';

const MANAGE_GUILD_PERMISSION = 0x20;
const ADMIN_PERMISSION = 0x8;

interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

interface GuildSettingRow {
  guild_id: string;
}

export async function guildRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized access' });
    }
  });

  fastify.get('/api/guilds', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { accessToken: string };

    try {
      const response = await axios.get<DiscordGuild[]>('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      });

      const manageableGuilds = response.data.filter((guild) => {
        const perms = BigInt(guild.permissions);
        return guild.owner || (perms & BigInt(ADMIN_PERMISSION)) !== BigInt(0) || (perms & BigInt(MANAGE_GUILD_PERMISSION)) !== BigInt(0);
      });

      const { rows } = await db.query<GuildSettingRow>('SELECT guild_id FROM guild_settings');
      const botGuildIds = new Set(rows ? rows.map((row: GuildSettingRow) => row.guild_id) : []);

      const result = manageableGuilds.map((guild) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        hasBot: botGuildIds.has(guild.id),
      }));

      return reply.send({ guilds: result });
    } catch (err: any) {
      request.log.error(err, 'Failed to fetch user guilds');
      return reply.status(500).send({ error: 'Failed to retrieve server list' });
    }
  });
}