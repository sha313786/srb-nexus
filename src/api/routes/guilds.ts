import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { db } from '../../core/database';
import { bot } from '../../index';
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
  welcome_bg_url?: string | null;
  leave_channel_id?: string | null;
  autorole_id?: string | null;
  log_channel_id?: string | null;
  anti_links?: boolean;
  anti_spam?: boolean;
  level_channel_id?: string | null;
  xp_rate?: number;
  dj_role_id?: string | null;
  default_volume?: number;
  currency_symbol?: string;
  daily_reward?: number;
  transcript_channel_id?: string | null;
  support_role_id?: string | null;
  updated_at?: Date;
}

const ADMIN_BIT = BigInt(0x8);
const MANAGE_GUILD_BIT = BigInt(0x20);

async function verifyUserGuildAccess(accessToken: string, guildId: string): Promise<boolean> {
  try {
    const response = await axios.get<DiscordGuild[]>('https://discord.com/api/v10/users/@me/guilds', {
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
  // Global JWT authentication verification hook for all guild endpoints
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await (request as any).jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized access' });
    }
  });

  // GET /api/guilds - List user's manageable servers
  fastify.get('/api/guilds', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;

    if (!user || !user.accessToken) {
      reply.clearCookie('nexus_token', { path: '/' });
      return reply.status(401).send({ error: 'Invalid or missing authentication token' });
    }

    let discordGuilds: DiscordGuild[] = [];
    try {
      const response = await axios.get<DiscordGuild[]>('https://discord.com/api/v10/users/@me/guilds', {
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

    const result = manageableGuilds.map((guild) => {
      const botGuild = bot.guilds.cache.get(guild.id);
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
        hasBot: Boolean(botGuild),
      };
    });

    return reply.send({ guilds: result });
  });

  // GET /api/guilds/:id/data - Fetch server channels and roles for drop-downs
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
      const fetchedChannels = await guild.channels.fetch();
      const channels = fetchedChannels
        .filter((c) => c !== null && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement))
        .map((c) => ({ id: c!.id, name: c!.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

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

  // GET /api/guilds/:id/settings - Base guild settings reader
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
            welcome_bg_url: null,
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

  // GET /api/guilds/:id/modules/:module - Read specific configuration module
  fastify.get('/api/guilds/:id/modules/:module', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, module } = request.params as { id: string; module: string };

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

      const settings = result.rows[0] || { guild_id: id, prefix: '!' };
      return reply.send({ settings });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch module settings');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/guilds/:id/modules/:module - Save target tab configuration
  fastify.post('/api/guilds/:id/modules/:module', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, module } = request.params as { id: string; module: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    const body = (request.body as Record<string, any>) || {};

    try {
      // Upsert shell row if not exists
      await db.query(
        `INSERT INTO guild_settings (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
        [id]
      );

      if (module === 'overview') {
        const cleanPrefix = body.prefix ? String(body.prefix).trim() : '!';
        await db.query(
          `UPDATE guild_settings 
           SET prefix = $1, 
               updated_at = NOW()
           WHERE guild_id = $2`,
          [cleanPrefix, id]
        );
      } else if (module === 'welcome') {
        const cleanChannel = body.welcome_channel_id ? String(body.welcome_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanLeaveChannel = body.leave_channel_id ? String(body.leave_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanRole = body.autorole_id ? String(body.autorole_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanBgUrl = body.welcome_bg_url && String(body.welcome_bg_url).trim().length > 0 ? String(body.welcome_bg_url).trim() : null;
        const cleanMsg = body.welcome_message && String(body.welcome_message).trim().length > 0
          ? String(body.welcome_message).trim()
          : (cleanChannel ? 'Welcome to the server, {user}!' : null);

        await db.query(
          `UPDATE guild_settings 
           SET welcome_channel_id = $1, 
               welcome_message = $2, 
               leave_channel_id = $3, 
               autorole_id = $4,
               welcome_bg_url = $5,
               updated_at = NOW()
           WHERE guild_id = $6`,
          [cleanChannel, cleanMsg, cleanLeaveChannel, cleanRole, cleanBgUrl, id]
        );
      } else if (module === 'moderation') {
        const cleanLogChannel = body.log_channel_id ? String(body.log_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        await db.query(
          `UPDATE guild_settings 
           SET log_channel_id = $1, 
               anti_links = $2, 
               anti_spam = $3,
               updated_at = NOW()
           WHERE guild_id = $4`,
          [cleanLogChannel, Boolean(body.anti_links), Boolean(body.anti_spam), id]
        );
      } else if (module === 'levels') {
        const cleanLvlChannel = body.level_channel_id ? String(body.level_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        await db.query(
          `UPDATE guild_settings 
           SET level_channel_id = $1, 
               xp_rate = $2, 
               updated_at = NOW()
           WHERE guild_id = $3`,
          [cleanLvlChannel, Number(body.xp_rate) || 1.0, id]
        );
      } else if (module === 'music') {
        const cleanDjRole = body.dj_role_id ? String(body.dj_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        await db.query(
          `UPDATE guild_settings 
           SET dj_role_id = $1, 
               default_volume = $2, 
               updated_at = NOW()
           WHERE guild_id = $3`,
          [cleanDjRole, Number(body.default_volume) || 80, id]
        );
      } else if (module === 'economy') {
        await db.query(
          `UPDATE guild_settings 
           SET currency_symbol = $1, 
               daily_reward = $2, 
               updated_at = NOW()
           WHERE guild_id = $3`,
          [body.currency_symbol || '🪙', Number(body.daily_reward) || 100, id]
        );
      } else if (module === 'tickets') {
        const cleanTranscriptChannel = body.transcript_channel_id ? String(body.transcript_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanSupportRole = body.support_role_id ? String(body.support_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        await db.query(
          `UPDATE guild_settings 
           SET transcript_channel_id = $1, 
               support_role_id = $2, 
               updated_at = NOW()
           WHERE guild_id = $3`,
          [cleanTranscriptChannel, cleanSupportRole, id]
        );
      } else {
        return reply.status(400).send({ error: `Unknown configuration module: ${module}` });
      }

      return reply.send({ success: true, message: `Module settings for [${module}] saved successfully` });
    } catch (err: any) {
      request.log.error({ err }, `Failed to update module settings for ${module}`);
      return reply.status(500).send({ error: 'Failed to save module configuration' });
    }
  });

  // POST /api/guilds/:id/settings - Legacy bulk update fallback
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
    const prefix = body.prefix || body.cmdPrefix || '!';

    const rawChannelId = body.welcome_channel_id ?? body.welcomeChannelId ?? body.channel_id;
    const rawMessage = body.welcome_message ?? body.welcomeMessage ?? body.message;
    const rawRoleId = body.autorole_id ?? body.autoroleId ?? body.role_id;
    const rawBgUrl = body.welcome_bg_url ?? body.welcomeBgUrl;

    const cleanChannelId = rawChannelId ? String(rawChannelId).replace(/[<#@!&>]/g, '').trim() : null;
    const cleanRoleId = rawRoleId ? String(rawRoleId).replace(/[<#@!&>]/g, '').trim() : null;
    const cleanBgUrl = rawBgUrl && String(rawBgUrl).trim().length > 0 ? String(rawBgUrl).trim() : null;

    let cleanMessage: string | null = null;
    if (rawMessage !== undefined && rawMessage !== null) {
      const trimmed = String(rawMessage).trim();
      if (trimmed.length > 0) cleanMessage = trimmed;
    }

    if (cleanChannelId && !cleanMessage) {
      cleanMessage = 'Welcome to the server, {user}!';
    }

    try {
      await db.query(
        `INSERT INTO guild_settings (guild_id, prefix, welcome_channel_id, welcome_message, welcome_bg_url, autorole_id, updated_at)
         VALUES ($1, $2, $3, COALESCE(NULLIF($4, ''), 'Welcome to the server, {user}!'), $5, $6, NOW())
         ON CONFLICT (guild_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           welcome_channel_id = EXCLUDED.welcome_channel_id,
           welcome_message = COALESCE(NULLIF(EXCLUDED.welcome_message, ''), 'Welcome to the server, {user}!'),
           welcome_bg_url = EXCLUDED.welcome_bg_url,
           autorole_id = EXCLUDED.autorole_id,
           updated_at = NOW()`,
        [id, prefix, cleanChannelId, cleanMessage, cleanBgUrl, cleanRoleId]
      );

      return reply.send({ success: true, message: 'Settings saved successfully' });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to update guild settings');
      return reply.status(500).send({ error: 'Failed to update settings' });
    }
  });
}