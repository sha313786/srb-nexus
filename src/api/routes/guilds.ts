import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { db } from '../../core/database';
import { bot } from '../../index'; // Import the running bot client
import { ChannelType } from 'discord.js';

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
  prefix?: string;
  welcome_channel_id?: string | null;
  welcome_message?: string | null;
  autorole_id?: string | null;
  updated_at?: Date;
}

const ADMIN_BIT = BigInt(0x8);
const MANAGE_GUILD_BIT = BigInt(0x20);

async function verifyUserGuildAccess(accessToken: string, guildId: string): Promise<boolean> {
  try {
    const response = await axios.get<DiscordGuild[]>('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const targetGuild = (response.data || []).find((g) => g.id === guildId);
    if (!targetGuild) return false;
    if (targetGuild.owner) return true;

    const permStr = targetGuild.permissions_new || targetGuild.permissions;
    if (!permStr) return false;

    const perms = BigInt(permStr);
    return (perms & ADMIN_BIT) !== BigInt(0) || (perms & MANAGE_GUILD_BIT) !== BigInt(0);
  } catch {
    return false;
  }
}

export async function guildRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await (request as any).jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized access' });
    }
  });

  // GET /api/guilds
  fastify.get('/api/guilds', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;

    if (!user || !user.accessToken) {
      reply.clearCookie('nexus_token', { path: '/' });
      return reply.status(401).send({ error: 'Invalid or missing authentication token' });
    }

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

    const botGuildIds = new Set<string>();
    try {
      const dbResult = await db.query<GuildSettingRow>('SELECT guild_id FROM guild_settings');
      if (dbResult && dbResult.rows) {
        dbResult.rows.forEach((row: GuildSettingRow) => botGuildIds.add(row.guild_id));
      }
    } catch (dbErr: any) {
      request.log.warn({ dbErr }, 'Database query failed in /api/guilds, defaulting to empty set');
    }

    const result = manageableGuilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
      hasBot: botGuildIds.has(guild.id),
    }));

    return reply.send({ guilds: result });
  });

  // GET /api/guilds/:id/data - Fetch server channels and roles for dropdowns
  fastify.get('/api/guilds/:id/data', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    const guild = bot.guilds.cache.get(id);
    if (!guild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    try {
      // Fetch text channels via API fallback to avoid cache miss issues
      const fetchedChannels = await guild.channels.fetch();
      const channels = fetchedChannels
        .filter((c) => c !== null && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
        .map((c) => ({ id: c!.id, name: c!.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      // Fetch assignable roles via API fallback
      const fetchedRoles = await guild.roles.fetch();
      const roles = fetchedRoles
        .filter((r) => r.name !== '@everyone' && !r.managed)
        .map((r) => ({ id: r.id, name: r.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return reply.send({ channels, roles });
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch channels and roles');
      return reply.status(500).send({ error: 'Failed to fetch server data' });
    }
  });

  // GET /api/guilds/:id/settings
  fastify.get('/api/guilds/:id/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    try {
      const result = await db.query<GuildSettingRow>(
        'SELECT * FROM guild_settings WHERE guild_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return reply.send({
          settings: {
            guild_id: id,
            prefix: '!',
            welcome_channel_id: null,
            welcome_message: 'Welcome to the server, {user}!',
            autorole_id: null,
          },
        });
      }

      return reply.send({ settings: result.rows[0] });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch guild settings');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/guilds/:id/settings
  fastify.post('/api/guilds/:id/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    const body = (request.body as Record<string, any>) || {};

    // 1. Dynamic Prefix Resolution
    const prefix = body.prefix || body.cmdPrefix || body.botPrefix || '!';

    // 2. Dynamic Channel ID Resolution (Checks all possible UI key variations)
    const rawChannelId =
      body.welcome_channel_id ??
      body.welcomeChannelId ??
      body.welcome_channel ??
      body.welcomeChannel ??
      body.channel_id ??
      body.channelId;

    // 3. Dynamic Message Resolution (Checks all possible text field keys)
    const rawMessage =
      body.welcome_message ??
      body.welcomeMessage ??
      body.welcome_text ??
      body.welcomeText ??
      body.welcome_msg ??
      body.welcomeMsg ??
      body.message;

    // 4. Dynamic Role ID Resolution
    const rawRoleId =
      body.autorole_id ??
      body.autoroleId ??
      body.auto_role_id ??
      body.autoRoleId ??
      body.role_id ??
      body.roleId;

    // Sanitize IDs down to raw numbers
    const cleanChannelId = rawChannelId
      ? String(rawChannelId).replace(/[<#@!&>]/g, '').trim()
      : null;

    const cleanRoleId = rawRoleId
      ? String(rawRoleId).replace(/[<#@!&>]/g, '').trim()
      : null;

    // Normalize Message: handle non-empty strings or supply a default fallback
    let cleanMessage: string | null = null;
    if (rawMessage !== undefined && rawMessage !== null) {
      const trimmed = String(rawMessage).trim();
      if (trimmed.length > 0) {
        cleanMessage = trimmed;
      }
    }

    // Fallback: If a channel is selected but message text was omitted or mismatched, provide a working default
    if (cleanChannelId && !cleanMessage) {
      cleanMessage = 'Welcome to the server, {user}!';
    }

    try {
      await db.query(
        `INSERT INTO guild_settings (guild_id, prefix, welcome_channel_id, welcome_message, autorole_id, updated_at)
         VALUES ($1, $2, $3, COALESCE(NULLIF($4, ''), 'Welcome to the server, {user}!'), $5, NOW())
         ON CONFLICT (guild_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           welcome_channel_id = EXCLUDED.welcome_channel_id,
           welcome_message = COALESCE(NULLIF(EXCLUDED.welcome_message, ''), 'Welcome to the server, {user}!'),
           autorole_id = EXCLUDED.autorole_id,
           updated_at = NOW()`,
        [id, prefix, cleanChannelId, cleanMessage, cleanRoleId]
      );

      request.log.info({
        receivedBodyKeys: Object.keys(body),
        resolvedValues: { cleanChannelId, cleanMessage, cleanRoleId }
      }, `[API] Saved guild settings for ${id}`);

      return reply.send({ success: true, message: 'Settings saved successfully' });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update guild settings');
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });
}