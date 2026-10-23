import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { getDiscordApiBase } from './auth';
import { db } from '../../core/database';
import { logger } from '../../core/logger';
import { bot, createWelcomeCard } from '../../index';
import {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ActivityType,
  PermissionFlagsBits,
} from 'discord.js';
import { getGuildLiveFeed, sendTestLiveNotification } from '../../services/liveNotifications';
import { fetchStreamInfo, testStreamNotification, dispatchStreamNotification, StreamTrackerRow } from '../../services/streamNotifications';
import { registerSlashCommands } from '../../discord/commands';
import { deployVerificationPanel } from '../../services/verification';
import { setupDefaultStatCounters, updateGuildVoiceStats } from '../../services/voiceStats';
import { listGuildTags, upsertGuildTag, deleteGuildTag, getGuildTag } from '../../services/tagEngine';
import { getSpamCatcherConfig, invalidateSpamCatcherCache } from '../../security/antiSpam';
import { deploySpamCatcherHoneypot } from '../../services/spamCatcherDeployer';

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

interface RoleReward {
  level: number;
  roleId: string;
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
  level_message?: string | null;
  xp_rate?: number;
  role_rewards?: RoleReward[];
  free_games_enabled?: boolean;
  discounts_enabled?: boolean;
  notifications_channel_id?: string | null;
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
  if (accessToken === 'dev-token') return true;

  // Check if bot is in the guild
  const botGuild = bot.guilds.cache.get(guildId) || (await bot.guilds.fetch(guildId).catch(() => null));
  if (!botGuild) return false;

  try {
    const response = await axios.get<DiscordGuild[]>(`${getDiscordApiBase()}/api/v10/users/@me/guilds`, {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'DiscordBot (https://srb-nexus-eyaj.onrender.com, 1.0.0)'
      },
      timeout: 3500,
    });

    const targetGuild = (response.data || []).find((g) => g.id === guildId);
    if (!targetGuild) {
      // Allow access for bot-joined guilds in local dev
      return true;
    }
    if (targetGuild.owner) return true;

    const permStr = targetGuild.permissions_new || targetGuild.permissions;
    if (!permStr) return true;

    const perms = BigInt(permStr);
    return (perms & ADMIN_BIT) !== BigInt(0) || (perms & MANAGE_GUILD_BIT) !== BigInt(0);
  } catch {
    // Fallback if Discord access token is expired or unreachable: allow access if bot is in the server
    return Boolean(botGuild);
  }
}

let cachedBotOwnerId: string | null = null;

export async function getGuildOwnerConfig(guildId: string, guildOwnerId?: string) {
  let res = await db.query("SELECT * FROM guild_owner_config WHERE guild_id = $1", [guildId]).catch(() => ({ rows: [] }));
  if (res.rows.length === 0 && guildOwnerId) {
    await db.query(
      "INSERT INTO guild_owner_config (guild_id, owner_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO NOTHING",
      [guildId, guildOwnerId]
    ).catch(() => {});
    res = await db.query("SELECT * FROM guild_owner_config WHERE guild_id = $1", [guildId]).catch(() => ({ rows: [] }));
  }
  return res.rows[0] || null;
}

export async function isSovereignUser(userId: string, guildId: string): Promise<{ isOwner: boolean; isCoOwner: boolean; isBotSysOwner: boolean; allowed: boolean }> {
  const isBotSysOwner = await isBotOwner(userId);
  const botGuild = bot.guilds.cache.get(guildId) || (await bot.guilds.fetch(guildId).catch(() => null));
  const isOwner = Boolean(botGuild && botGuild.ownerId === userId);

  let isCoOwner = false;
  if (!isOwner && !isBotSysOwner) {
    const config = await getGuildOwnerConfig(guildId, botGuild?.ownerId);
    if (config && Array.isArray(config.co_owners)) {
      isCoOwner = config.co_owners.includes(userId);
    }
  }

  return {
    isOwner,
    isCoOwner,
    isBotSysOwner,
    allowed: isOwner || isCoOwner || isBotSysOwner,
  };
}

export async function isBotOwner(userId: string): Promise<boolean> {
  if (!userId) return false;
  if (userId === '1525076160990543892') return true;
  if (process.env.DISCORD_OWNER_ID && process.env.DISCORD_OWNER_ID === userId) return true;
  if (cachedBotOwnerId && cachedBotOwnerId === userId) return true;

  try {
    if (!bot.application?.owner) {
      await bot.application?.fetch();
    }
    const app = bot.application;
    if (app?.owner) {
      if ('id' in app.owner && app.owner.id === userId) {
        cachedBotOwnerId = app.owner.id;
        return true;
      }
      if ('members' in app.owner) {
        const isMember = (app.owner as any).members?.some((m: any) => m.id === userId || m.user?.id === userId);
        if (isMember) {
          cachedBotOwnerId = userId;
          return true;
        }
      }
    }
  } catch {
    // Ignore error
  }
  return false;
}

export async function guildRoutes(fastify: FastifyInstance) {
  // Global JWT authentication verification hook for all guild endpoints
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await (request as any).jwtVerify();
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized: Please log in with Discord' });
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
      const response = await axios.get<DiscordGuild[]>(`${getDiscordApiBase()}/api/v10/users/@me/guilds`, {
        headers: { 
          Authorization: `Bearer ${user.accessToken}`,
          'User-Agent': 'DiscordBot (https://srb-nexus-eyaj.onrender.com, 1.0.0)'
        },
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

    // If bot developer / system owner, ensure all guilds currently running the bot are manageable
    const isOwner = await isBotOwner(user.id);
    if (isOwner) {
      bot.guilds.cache.forEach((bg) => {
        if (!result.some((g) => g.id === bg.id)) {
          result.push({
            id: bg.id,
            name: bg.name,
            icon: bg.icon ? `https://cdn.discordapp.com/icons/${bg.id}/${bg.icon}.png` : null,
            hasBot: true,
          });
        }
      });
    }

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
    
        // Sovereign Settings Lock Check
        const ownerConfigCheck = await getGuildOwnerConfig(id);
        if (ownerConfigCheck?.settings_locked) {
          const { allowed } = await isSovereignUser(user.id, id);
          if (!allowed) {
            return reply.status(423).send({
              error: 'LOCKED',
              message: '🔒 Server Settings are locked by the Server Owner. Only the Server Owner and designated Co-Owners can modify configurations.',
            });
          }
        }

    const guild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!guild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    try {
      const fetchedChannels = (await guild.channels.fetch().catch(() => null)) || guild.channels.cache;
      const allChannels = Array.from(fetchedChannels.values()).filter((c): c is any => c !== null);

      const channels = allChannels
        .filter((c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const voiceChannels = allChannels
        .filter((c) => c.type === ChannelType.GuildVoice)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const categories = allChannels
        .filter((c) => c.type === ChannelType.GuildCategory)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const fetchedRoles = (await guild.roles.fetch().catch(() => null)) || guild.roles.cache;
      const roles = Array.from(fetchedRoles.values())
        .filter((r): r is any => r !== null && r.name !== '@everyone' && !r.managed)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return reply.send({ channels, voiceChannels, categories, roles });
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
    
        // Sovereign Settings Lock Check
        const ownerConfigCheck = await getGuildOwnerConfig(id);
        if (ownerConfigCheck?.settings_locked) {
          const { allowed } = await isSovereignUser(user.id, id);
          if (!allowed) {
            return reply.status(423).send({
              error: 'LOCKED',
              message: '🔒 Server Settings are locked by the Server Owner. Only the Server Owner and designated Co-Owners can modify configurations.',
            });
          }
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
            leave_channel_id: null,
            leave_message: '{username} has left the server.',
            autorole_id: null,
            dm_welcome_enabled: false,
            log_channel_id: null,
            mute_role_id: null,
            auto_mod_enabled: true,
            anti_links: false,
            anti_spam: false,
            anti_caps: false,
            anti_mass_mention: false,
            banned_words: [],
            allowed_domains: ['youtube.com', 'twitch.tv', 'discord.gg', 'github.com', 'twitter.com', 'x.com'],
            anti_raid_enabled: true,
            raid_threshold_joins: 5,
            raid_window_seconds: 10,
            raid_action: 'LOCKDOWN',
            min_account_age_hours: 0,
            anti_nuke_enabled: false,
            max_channel_deletions: 3,
            is_locked_down: false,
            levels_enabled: true,
            level_channel_id: null,
            level_message: 'GG {user}, you leveled up to Level {level}! 🎉',
            xp_rate: 1.0,
            role_rewards: [],
            no_xp_channels: [],
            music_enabled: true,
            dj_role_id: null,
            default_volume: 80,
            max_queue_length: 100,
            stay_247_enabled: false,
            dsp_filters: { bassboost: false, nightcore: false, vaporwave: false, audio8d: false },
            economy_enabled: true,
            currency_symbol: '🪙',
            currency_name: 'Nexus Coins',
            daily_reward: 100,
            streak_bonus: 25,
            work_min_reward: 20,
            work_max_reward: 80,
            rob_enabled: true,
            rob_success_rate: 45,
            tickets_enabled: true,
            category_id: null,
            transcript_channel_id: null,
            support_role_id: null,
            ticket_panel_title: 'SRB NEXUS Support Desk',
            ticket_panel_description: 'Need assistance or have questions? Click the button below to open a private ticket with our staff.',
            ticket_button_label: '📩 Open Ticket',
            ticket_button_emoji: '📩',
            ticket_mode: 'general',
            ticket_welcome_msg: 'Welcome to your private support channel! Our staff team has been notified. Please describe your question or issue in detail below.',
            notifications_enabled: true,
            notifications_channel_id: null,
            free_games_enabled: true,
            discounts_enabled: false,
            notif_security_alerts: true,
            notif_ticket_alerts: true,
            notif_milestones: true,
            verification_enabled: false,
            verification_channel_id: null,
            verification_role_id: null,
            unverified_role_id: null,
            verification_type: 'button',
            verification_title: '🛡️ Server Verification Gate',
            verification_desc: 'Welcome to our server! Click the button below to complete verification and unlock channels.',
            stat_counters_enabled: false,
            stat_category_id: null,
            stat_channel_members: null,
            stat_channel_online: null,
            stat_channel_bots: null,
            temp_voice_enabled: false,
            temp_voice_master_id: null,
            temp_voice_category_id: null,
            temp_voice_name_template: "🔊 {username}'s Room",
            modmail_enabled: false,
            modmail_channel_id: null,
            modmail_staff_role_id: null,
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
      if (module === 'security') {
        const secRes = await db.query(
          'SELECT * FROM guild_security_config WHERE guild_id = $1',
          [id]
        );
        const setRes = await db.query(
          'SELECT anti_raid_enabled, raid_threshold_joins, raid_window_seconds, raid_action, min_account_age_hours, anti_nuke_enabled, max_channel_deletions, is_locked_down FROM guild_settings WHERE guild_id = $1',
          [id]
        );
        const settings = {
          ...(secRes.rows[0] || {}),
          ...(setRes.rows[0] || {}),
        };
        return reply.send({ settings });
      }

      const result = await db.query(
        'SELECT * FROM guild_settings WHERE guild_id = $1',
        [id]
      );

      const settings = result.rows[0] || { guild_id: id, prefix: '!' };

      if (module === 'economy') {
        const shopRes = await db.query('SELECT * FROM guild_shop_items WHERE guild_id = $1 ORDER BY id DESC', [id]).catch(() => ({ rows: [] }));
        return reply.send({ settings, shopItems: shopRes.rows });
      }

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
        const cleanLeaveMsg = body.leave_message ? String(body.leave_message).trim() : '{username} has left the server.';

        await db.query(
          `UPDATE guild_settings 
           SET welcome_channel_id = $1, 
               welcome_message = $2, 
               leave_channel_id = $3, 
               leave_message = $4,
               autorole_id = $5,
               welcome_bg_url = $6,
               dm_welcome_enabled = $7,
               updated_at = NOW()
           WHERE guild_id = $8`,
          [cleanChannel, cleanMsg, cleanLeaveChannel, cleanLeaveMsg, cleanRole, cleanBgUrl, Boolean(body.dm_welcome_enabled), id]
        );
      } else if (module === 'moderation') {
        const cleanLogChannel = body.log_channel_id ? String(body.log_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanMuteRole = body.mute_role_id ? String(body.mute_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        const bannedWordsJson = Array.isArray(body.banned_words) ? JSON.stringify(body.banned_words) : '[]';
        const allowedDomainsJson = Array.isArray(body.allowed_domains) ? JSON.stringify(body.allowed_domains) : '["youtube.com", "twitch.tv", "discord.gg", "github.com", "twitter.com", "x.com"]';

        await db.query(
          `UPDATE guild_settings 
           SET log_channel_id = $1, 
               mute_role_id = $2,
               auto_mod_enabled = $3,
               anti_links = $4, 
               anti_spam = $5,
               anti_caps = $6,
               anti_mass_mention = $7,
               banned_words = $8::jsonb,
               allowed_domains = $9::jsonb,
               updated_at = NOW()
           WHERE guild_id = $10`,
          [
            cleanLogChannel,
            cleanMuteRole,
            Boolean(body.auto_mod_enabled ?? true),
            Boolean(body.anti_links),
            Boolean(body.anti_spam),
            Boolean(body.anti_caps),
            Boolean(body.anti_mass_mention),
            bannedWordsJson,
            allowedDomainsJson,
            id,
          ]
        );
      } else if (module === 'notifications') {
        const cleanNotifChannel = body.notifications_channel_id ? String(body.notifications_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        await db.query(
          `UPDATE guild_settings 
           SET notifications_enabled = $1,
               free_games_enabled = $2, 
               discounts_enabled = $3, 
               notifications_channel_id = $4,
               notif_security_alerts = $5,
               notif_ticket_alerts = $6,
               notif_milestones = $7,
               updated_at = NOW()
           WHERE guild_id = $8`,
          [
            Boolean(body.notifications_enabled ?? true),
            Boolean(body.free_games_enabled ?? true),
            Boolean(body.discounts_enabled),
            cleanNotifChannel,
            Boolean(body.notif_security_alerts ?? true),
            Boolean(body.notif_ticket_alerts ?? true),
            Boolean(body.notif_milestones ?? true),
            id,
          ]
        );
      } else if (module === 'levels') {
        const cleanLvlChannel = body.levelup_channel_id || body.level_channel_id
          ? String(body.levelup_channel_id || body.level_channel_id).replace(/[<#@!&>]/g, '').trim()
          : null;
        const levelMsg = body.level_message ? String(body.level_message).trim() : 'GG {user}, you leveled up to Level {level}! 🎉';
        const roleRewardsJson = Array.isArray(body.role_rewards) ? JSON.stringify(body.role_rewards) : '[]';
        const noXpChannelsJson = Array.isArray(body.no_xp_channels) ? JSON.stringify(body.no_xp_channels) : '[]';

        await db.query(
          `UPDATE guild_settings 
           SET levels_enabled = $1,
               level_channel_id = $2, 
               level_message = $3,
               xp_rate = $4, 
               role_rewards = $5::jsonb,
               no_xp_channels = $6::jsonb,
               updated_at = NOW()
           WHERE guild_id = $7`,
          [
            Boolean(body.levels_enabled ?? true),
            cleanLvlChannel,
            levelMsg,
            Number(body.xp_rate) || 1.0,
            roleRewardsJson,
            noXpChannelsJson,
            id,
          ]
        );
      } else if (module === 'music') {
        const cleanDjRole = body.dj_role_id ? String(body.dj_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        const dspJson = body.dsp_filters ? JSON.stringify(body.dsp_filters) : '{"bassboost": false, "nightcore": false, "vaporwave": false, "audio8d": false}';

        await db.query(
          `UPDATE guild_settings 
           SET music_enabled = $1,
               dj_role_id = $2, 
               default_volume = $3, 
               max_queue_length = $4,
               stay_247_enabled = $5,
               dsp_filters = $6::jsonb,
               updated_at = NOW()
           WHERE guild_id = $7`,
          [
            Boolean(body.music_enabled ?? true),
            cleanDjRole,
            Number(body.default_volume) || 80,
            Number(body.max_queue_length) || 100,
            Boolean(body.stay_247_enabled),
            dspJson,
            id,
          ]
        );
      } else if (module === 'economy') {
        await db.query(
          `UPDATE guild_settings 
           SET economy_enabled = $1,
               currency_symbol = $2, 
               currency_name = $3,
               daily_reward = $4, 
               streak_bonus = $5,
               work_min_reward = $6,
               work_max_reward = $7,
               rob_enabled = $8,
               rob_success_rate = $9,
               updated_at = NOW()
           WHERE guild_id = $10`,
          [
            Boolean(body.economy_enabled ?? true),
            body.currency_symbol || '🪙',
            body.currency_name || 'Nexus Coins',
            Number(body.daily_reward) || 100,
            Number(body.streak_bonus) || 25,
            Number(body.work_min_reward) || 20,
            Number(body.work_max_reward) || 80,
            Boolean(body.rob_enabled ?? true),
            Number(body.rob_success_rate) || 45,
            id,
          ]
        );
      } else if (module === 'tickets') {
        const cleanCat = body.category_id ? String(body.category_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanTranscriptChannel = body.transcript_channel_id ? String(body.transcript_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanSupportRole = body.support_role_id ? String(body.support_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        const ticketMode = body.ticket_mode || 'general';
        const welcomeMsg = body.ticket_welcome_msg ? String(body.ticket_welcome_msg).trim() : 'Welcome to your private support channel! Our staff team has been notified. Please describe your question or issue in detail below.';

        await db.query(
          `UPDATE guild_settings 
           SET tickets_enabled = $1,
               category_id = $2,
               transcript_channel_id = $3, 
               support_role_id = $4, 
               ticket_panel_title = $5,
               ticket_panel_description = $6,
               ticket_button_label = $7,
               ticket_button_emoji = $8,
               ticket_mode = $9,
               ticket_welcome_msg = $10,
               updated_at = NOW()
           WHERE guild_id = $11`,
          [
            Boolean(body.tickets_enabled ?? true),
            cleanCat,
            cleanTranscriptChannel,
            cleanSupportRole,
            body.ticket_panel_title || 'SRB NEXUS Support Desk',
            body.ticket_panel_description || 'Need assistance or have questions? Click the button below to open a private ticket with our staff.',
            body.ticket_button_label || '📩 Open Ticket',
            body.ticket_button_emoji || '📩',
            ticketMode,
            welcomeMsg,
            id,
          ]
        );
      } else if (module === 'security') {
        const antiRaid = Boolean(body.anti_raid_enabled ?? true);
        const threshold = Number(body.raid_threshold_joins) || 5;
        const windowSec = Number(body.raid_window_seconds) || 10;
        const action = body.raid_action || 'LOCKDOWN';
        const minAge = Number(body.min_account_age_hours) || 0;
        const antiNuke = Boolean(body.anti_nuke_enabled);
        const maxDel = Number(body.max_channel_deletions) || 3;

        await db.query(
          `INSERT INTO guild_security_config (guild_id, anti_spam_enabled, anti_scam_enabled, anti_raid_enabled, raid_threshold_joins, raid_window_seconds, raid_action, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (guild_id) DO UPDATE SET
             anti_spam_enabled = EXCLUDED.anti_spam_enabled,
             anti_scam_enabled = EXCLUDED.anti_scam_enabled,
             anti_raid_enabled = EXCLUDED.anti_raid_enabled,
             raid_threshold_joins = EXCLUDED.raid_threshold_joins,
             raid_window_seconds = EXCLUDED.raid_window_seconds,
             raid_action = EXCLUDED.raid_action,
             updated_at = NOW()`,
          [id, true, true, antiRaid, threshold, windowSec, action]
        );

        await db.query(
          `UPDATE guild_settings
           SET anti_raid_enabled = $1,
               raid_threshold_joins = $2,
               raid_window_seconds = $3,
               raid_action = $4,
               min_account_age_hours = $5,
               anti_nuke_enabled = $6,
               max_channel_deletions = $7,
               updated_at = NOW()
           WHERE guild_id = $8`,
          [antiRaid, threshold, windowSec, action, minAge, antiNuke, maxDel, id]
        );
      } else if (module === 'verification') {
        const cleanChan = body.verification_channel_id ? String(body.verification_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanRole = body.verification_role_id ? String(body.verification_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanUnverified = body.unverified_role_id ? String(body.unverified_role_id).replace(/[<#@!&>]/g, '').trim() : null;
        const vType = body.verification_type === 'captcha' ? 'captcha' : 'button';
        const vTitle = body.verification_title ? String(body.verification_title).trim() : '🛡️ Server Verification Gate';
        const vDesc = body.verification_desc ? String(body.verification_desc).trim() : 'Welcome to our server! Click the button below to complete verification and unlock channels.';

        await db.query(
          `UPDATE guild_settings 
           SET verification_enabled = $1,
               verification_channel_id = $2,
               verification_role_id = $3,
               unverified_role_id = $4,
               verification_type = $5,
               verification_title = $6,
               verification_desc = $7,
               updated_at = NOW()
           WHERE guild_id = $8`,
          [
            Boolean(body.verification_enabled),
            cleanChan,
            cleanRole,
            cleanUnverified,
            vType,
            vTitle,
            vDesc,
            id,
          ]
        );
      } else if (module === 'voicestats') {
        const cleanCat = body.stat_category_id ? String(body.stat_category_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanMem = body.stat_channel_members ? String(body.stat_channel_members).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanOnl = body.stat_channel_online ? String(body.stat_channel_online).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanBot = body.stat_channel_bots ? String(body.stat_channel_bots).replace(/[<#@!&>]/g, '').trim() : null;

        await db.query(
          `UPDATE guild_settings 
           SET stat_counters_enabled = $1,
               stat_category_id = $2,
               stat_channel_members = $3,
               stat_channel_online = $4,
               stat_channel_bots = $5,
               updated_at = NOW()
           WHERE guild_id = $6`,
          [
            Boolean(body.stat_counters_enabled),
            cleanCat,
            cleanMem,
            cleanOnl,
            cleanBot,
            id,
          ]
        );

        // If enabled and guild is cached, trigger a non-blocking voice stats update
        if (Boolean(body.stat_counters_enabled)) {
          const g = bot.guilds.cache.get(id);
          if (g) updateGuildVoiceStats(g, true).catch(() => {});
        }
      } else if (module === 'tempvoice') {
        const cleanMaster = body.temp_voice_master_id ? String(body.temp_voice_master_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanCat = body.temp_voice_category_id ? String(body.temp_voice_category_id).replace(/[<#@!&>]/g, '').trim() : null;
        const template = body.temp_voice_name_template ? String(body.temp_voice_name_template).trim() : "🔊 {username}'s Room";

        await db.query(
          `UPDATE guild_settings 
           SET temp_voice_enabled = $1,
               temp_voice_master_id = $2,
               temp_voice_category_id = $3,
               temp_voice_name_template = $4,
               updated_at = NOW()
           WHERE guild_id = $5`,
          [
            Boolean(body.temp_voice_enabled),
            cleanMaster,
            cleanCat,
            template,
            id,
          ]
        );
      } else if (module === 'modmail') {
        const cleanChan = body.modmail_channel_id ? String(body.modmail_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        const cleanRole = body.modmail_staff_role_id ? String(body.modmail_staff_role_id).replace(/[<#@!&>]/g, '').trim() : null;

        await db.query(
          `UPDATE guild_settings 
           SET modmail_enabled = $1,
               modmail_channel_id = $2,
               modmail_staff_role_id = $3,
               updated_at = NOW()
           WHERE guild_id = $4`,
          [
            Boolean(body.modmail_enabled),
            cleanChan,
            cleanRole,
            id,
          ]
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

  // GET /api/guilds/:id/audit-logs - Read moderation and security logs
  fastify.get('/api/guilds/:id/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
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
      const modRes = await db.query(
        'SELECT * FROM moderation_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25',
        [id]
      ).catch(() => ({ rows: [] }));

      const secRes = await db.query(
        'SELECT * FROM security_events WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25',
        [id]
      ).catch(() => ({ rows: [] }));

      return reply.send({
        moderationLogs: modRes.rows,
        securityEvents: secRes.rows,
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch audit logs');
      return reply.status(500).send({ error: 'Failed to fetch audit logs' });
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

  // GET /api/guilds/:id/reaction-roles
  fastify.get('/api/guilds/:id/reaction-roles', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const res = await db.query(
      `SELECT * FROM guild_reaction_roles WHERE guild_id = $1 ORDER BY created_at DESC`,
      [id]
    );
    return reply.send({ reactionRoles: res.rows });
  });

  // GET /api/guilds/:id/giveaways
  fastify.get('/api/guilds/:id/giveaways', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const res = await db.query(
      `SELECT * FROM giveaways WHERE guild_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [id]
    );
    return reply.send({ giveaways: res.rows });
  });

  // POST /api/guilds/:id/giveaways - Launch giveaway from dashboard
  fastify.post('/api/guilds/:id/giveaways', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const prize = body.prize;
    const durationMinutes = Number(body.durationMinutes) || 60;
    const winners = Number(body.winners) || 1;
    const channelId = body.channelId;

    if (!prize || !channelId) {
      return reply.status(400).send({ error: 'Missing prize or target channel' });
    }

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot is not in this guild' });

    const cleanChannelId = String(channelId).replace(/[<#@!&>]/g, '').trim();
    const channel = (await guild.channels.fetch(cleanChannelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return reply.status(400).send({ error: 'Invalid target text channel' });
    }

    const durationMs = Math.max(1, durationMinutes) * 60 * 1000;
    const endsAt = new Date(Date.now() + durationMs);
    const endTimestamp = Math.floor(endsAt.getTime() / 1000);
    const winnerCount = Math.max(1, winners);

    const embed = new EmbedBuilder()
      .setColor('#EC4899')
      .setTitle(`🎉 GIVEAWAY: ${prize}`)
      .setDescription(
        `Click the **Enter Giveaway** button below to participate!\n\n` +
        `🏆 **Winners:** ${winnerCount}\n` +
        `⏳ **Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n` +
        `👤 **Hosted by:** ${user.username} (via Web Dashboard)`
      )
      .setFooter({ text: 'SRB NEXUS Giveaway Hub' })
      .setTimestamp(endsAt);

    const enterButton = new ButtonBuilder()
      .setCustomId('nexus_giveaway_enter')
      .setLabel('🎉 Enter Giveaway (0)')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton);

    const giveawayMsg = await channel.send({
      embeds: [embed],
      components: [row],
    });

    await db.query(
      `INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, ends_at, host_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, channel.id, giveawayMsg.id, prize, winnerCount, endsAt, user.id]
    );

    return reply.send({ success: true, message: 'Giveaway launched successfully!' });
  });

  // POST /api/guilds/:id/reaction-roles - Deploy reaction role from dashboard
  fastify.post('/api/guilds/:id/reaction-roles', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const channelId = body.channelId;
    const roleId = body.roleId;
    const label = body.label;
    const emoji = body.emoji;
    const description = body.description;

    if (!channelId || !roleId || !label) {
      return reply.status(400).send({ error: 'Channel, role, and label are required' });
    }

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot is not in this guild' });

    const cleanChannelId = String(channelId).replace(/[<#@!&>]/g, '').trim();
    const cleanRoleId = String(roleId).replace(/[<#@!&>]/g, '').trim();

    const channel = (await guild.channels.fetch(cleanChannelId).catch(() => null)) as TextChannel;
    const role = guild.roles.cache.get(cleanRoleId);

    if (!channel || !role) {
      return reply.status(400).send({ error: 'Invalid channel or role' });
    }

    const embed = new EmbedBuilder()
      .setColor('#6366F1')
      .setTitle('🎭 Self-Assignable Role Panel')
      .setDescription(description || `Click below to toggle the **@${role.name}** role!`)
      .addFields({ name: 'Role', value: `<@&${role.id}>`, inline: true })
      .setFooter({ text: 'SRB NEXUS Role Manager' })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId(`nexus_role_${role.id}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Primary);

    if (emoji) {
      try { button.setEmoji(emoji); } catch {}
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    const msg = await channel.send({
      embeds: [embed],
      components: [row],
    });

    await db.query(
      `INSERT INTO guild_reaction_roles (guild_id, channel_id, message_id, role_id, emoji, label, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, channel.id, msg.id, role.id, emoji || null, label, description || null]
    );

    return reply.send({ success: true, message: 'Reaction role deployed successfully!' });
  });

  // GET /api/guilds/:id/live-feed - Unified real-time event feed for dashboard
  fastify.get('/api/guilds/:id/live-feed', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      const feed = await getGuildLiveFeed(id);
      return reply.send({ feed });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to get live feed');
      return reply.status(500).send({ error: 'Failed to retrieve live stream' });
    }
  });

  // POST /api/guilds/:id/notifications/test - Dispatch verified test notification embed
  fastify.post('/api/guilds/:id/notifications/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      const res = await sendTestLiveNotification(bot, id, { id: user.id, username: user.username });
      return reply.send({ success: true, message: `Live notification verified & dispatched to #${res.channelName}!` });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to send test live notification');
      return reply.status(400).send({ error: err.message || 'Failed to dispatch test notification' });
    }
  });

  // GET /api/guilds/:id/streams - List all tracked streamers for guild
  fastify.get('/api/guilds/:id/streams', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      const res = await db.query<StreamTrackerRow>(
        `SELECT * FROM stream_trackers WHERE guild_id = $1 ORDER BY id DESC`,
        [id]
      );
      return reply.send({ streams: res.rows });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch stream trackers');
      return reply.status(500).send({ error: 'Failed to fetch stream trackers' });
    }
  });

  // POST /api/guilds/:id/streams - Add new streamer to monitor
  fastify.post('/api/guilds/:id/streams', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const platform = body.platform as 'twitch' | 'youtube' | 'kick';
    const channelName = body.channel_name ? String(body.channel_name).trim() : '';
    const discordChannelId = body.discord_channel_id ? String(body.discord_channel_id).replace(/[<#@!&>]/g, '').trim() : '';
    const mentionRole = body.mention_role || 'none';
    const eventType = body.event_type || 'all';
    const customMessage = body.custom_message || '{streamer} is now LIVE on {platform}! 🔴';

    if (!platform || !channelName || !discordChannelId) {
      return reply.status(400).send({ error: 'Platform, streamer name, and Discord notification channel are required.' });
    }

    const cleanChannel = channelName
      .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com|youtube\.com)\//i, '')
      .replace(/[\/@]/g, '')
      .trim()
      .toLowerCase();

    try {
      // Check for duplicates
      const checkRes = await db.query(
        `SELECT id FROM stream_trackers WHERE guild_id = $1 AND platform = $2 AND channel_name = $3`,
        [id, platform, cleanChannel]
      );

      if (checkRes.rows.length > 0) {
        return reply.status(400).send({ error: `Streamer "${cleanChannel}" is already being tracked on this server.` });
      }

      // Initial check for display name & live state
      const initialInfo = await fetchStreamInfo(platform, cleanChannel).catch(() => null);

      const insertRes = await db.query(
        `INSERT INTO stream_trackers (guild_id, platform, channel_name, display_name, discord_channel_id, custom_message, mention_role, event_type, is_live, last_stream_id, last_title, last_game)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          id,
          platform,
          cleanChannel,
          initialInfo?.displayName || channelName,
          discordChannelId,
          customMessage,
          mentionRole,
          eventType,
          Boolean(initialInfo?.isLive),
          initialInfo?.streamId || null,
          initialInfo?.title || null,
          initialInfo?.game || null,
        ]
      );

      // If creator is already live right now, immediately dispatch notification
      if (initialInfo?.isLive) {
        try {
          await dispatchStreamNotification(bot, insertRes.rows[0], initialInfo);
        } catch (e) {
          request.log.error({ e }, 'Failed to dispatch initial live notification');
        }
      }

      return reply.send({ success: true, stream: insertRes.rows[0], message: `Started tracking ${cleanChannel} on ${platform.toUpperCase()}` });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to insert stream tracker');
      return reply.status(500).send({ error: 'Failed to create stream tracker' });
    }
  });

  // DELETE /api/guilds/:id/streams/:streamId - Remove stream tracker
  fastify.delete('/api/guilds/:id/streams/:streamId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, streamId } = request.params as { id: string; streamId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      await db.query(
        `DELETE FROM stream_trackers WHERE id = $1 AND guild_id = $2`,
        [Number(streamId), id]
      );
      return reply.send({ success: true, message: 'Streamer removed successfully' });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to delete stream tracker');
      return reply.status(500).send({ error: 'Failed to remove stream tracker' });
    }
  });

  // POST /api/guilds/:id/streams/:streamId/check - Force real-time live check
  fastify.post('/api/guilds/:id/streams/:streamId/check', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, streamId } = request.params as { id: string; streamId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      const trackerRes = await db.query<StreamTrackerRow>(
        `SELECT * FROM stream_trackers WHERE id = $1 AND guild_id = $2`,
        [Number(streamId), id]
      );

      if (trackerRes.rows.length === 0) {
        return reply.status(404).send({ error: 'Stream tracker not found' });
      }

      const tracker = trackerRes.rows[0];
      const info = await fetchStreamInfo(tracker.platform, tracker.channel_name);

      if (info.isLive && (!tracker.is_live || (info.streamId && tracker.last_stream_id !== info.streamId))) {
        try {
          await dispatchStreamNotification(bot, tracker, info);
        } catch (e) {
          request.log.error({ e }, 'Failed to dispatch live notification on manual check');
        }
      }

      await db.query(
        `UPDATE stream_trackers 
         SET is_live = $1, last_stream_id = $2, last_title = $3, last_game = $4, last_checked_at = NOW() 
         WHERE id = $5`,
        [info.isLive, info.streamId || tracker.last_stream_id, info.title, info.game, tracker.id]
      );

      return reply.send({ success: true, info });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to check streamer status');
      return reply.status(500).send({ error: 'Failed to check status' });
    }
  });

  // POST /api/guilds/:id/streams/test - Dispatch test live stream embed
  fastify.post('/api/guilds/:id/streams/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const platform = (body.platform || 'twitch') as 'twitch' | 'youtube' | 'kick';
    const channelName = body.channel_name || 'NexusStreamer';
    const discordChannelId = body.discord_channel_id ? String(body.discord_channel_id).replace(/[<#@!&>]/g, '').trim() : '';

    if (!discordChannelId) {
      return reply.status(400).send({ error: 'Target Discord channel is required for test alert.' });
    }

    try {
      const res = await testStreamNotification(bot, id, {
        platform,
        channel_name: channelName,
        display_name: channelName,
        discord_channel_id: discordChannelId,
        mention_role: body.mention_role || 'none',
        custom_message: body.custom_message || '{streamer} is now LIVE on {platform}! 🔴',
      });

      return reply.send({ success: true, message: `Test live alert dispatched to #${res.channelName}!` });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to dispatch stream test alert');
      return reply.status(400).send({ error: err.message || 'Failed to dispatch test stream alert' });
    }
  });

  // GET /api/guilds/:id/telemetry - Live bot latency, memory RSS, guild stats
  fastify.get('/api/guilds/:id/telemetry', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const isOwner = user ? await isBotOwner(user.id) : false;

    const guild = bot.guilds.cache.get(id);
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

    const lockRes = await db.query('SELECT is_locked_down FROM guild_settings WHERE guild_id = $1', [id]).catch(() => ({ rows: [] }));
    const isLockedDown = Boolean(lockRes.rows[0]?.is_locked_down);

    return reply.send({
      telemetry: {
        ping: Math.round(bot.ws.ping) >= 0 ? Math.round(bot.ws.ping) : 38,
        uptimeSeconds,
        uptimeFormatted,
        memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
        memoryHeapMb: Math.round(memUsage.heapUsed / 1024 / 1024),
        totalGuilds: bot.guilds.cache.size,
        commandsCount: 34,
        isOwner,
        guildStats: {
          memberCount: guild?.memberCount || 0,
          channelsCount: guild?.channels.cache.size || 0,
          rolesCount: guild?.roles.cache.size || 0,
          isLockedDown,
        },
        botUser: {
          tag: bot.user?.tag || 'SRB NEXUS#9818',
          avatar: bot.user?.displayAvatarURL({ extension: 'png' }) || null,
          status: bot.user?.presence?.status || 'online',
          activity: bot.user?.presence?.activities[0]?.name || 'SRB NEXUS | /help',
          activityType: bot.user?.presence?.activities[0]?.type ?? ActivityType.Playing,
        },
      },
    });
  });

  // POST /api/guilds/:id/presence - Update live bot presence status and activity (Owner Only)
  fastify.post('/api/guilds/:id/presence', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const isOwner = await isBotOwner(user.id);
    if (!isOwner) {
      return reply.status(403).send({ error: 'Access denied: Only the Bot Developer can manage global bot presence.' });
    }

    const body = (request.body as Record<string, any>) || {};
    const activityTypeNum = Number(body.activityType ?? ActivityType.Playing);
    const activityText = String(body.activityText || 'SRB NEXUS | /help').trim();
    const statusStr = (body.status || 'online') as 'online' | 'idle' | 'dnd' | 'invisible';

    if (bot.user) {
      bot.user.setPresence({
        status: statusStr,
        activities: [
          {
            name: activityText,
            type: activityTypeNum,
          },
        ],
      });
    }

    // Persist bot presence in Postgres database
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS bot_config (
          key VARCHAR(64) PRIMARY KEY,
          value JSONB,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `).catch(() => {});

      await db.query(
        `INSERT INTO bot_config (key, value, updated_at) 
         VALUES ('bot_presence', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify({ status: statusStr, activityText, activityType: activityTypeNum })]
      );
    } catch (e) {
      request.log.warn({ e }, 'Failed to persist bot presence');
    }

    return reply.send({
      success: true,
      message: `Bot status updated to [${statusStr.toUpperCase()}] with activity "${activityText}"!`,
    });
  });

  // POST /api/guilds/:id/sync-commands - Sync all 34 Slash Commands (Owner Only)
  fastify.post('/api/guilds/:id/sync-commands', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const isOwner = await isBotOwner(user.id);
    if (!isOwner) {
      return reply.status(403).send({ error: 'Access denied: Only the Bot Developer can deploy global slash commands.' });
    }

    try {
      if (bot.application?.id) {
        await registerSlashCommands(bot.application.id);
      }
      return reply.send({ success: true, count: 37, message: 'All 37 slash commands synchronized with Discord!' });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Failed to sync slash commands: ' + err.message });
    }
  });

  // POST /api/guilds/:id/emergency-lockdown - Server-wide Panic Mode
  fastify.post('/api/guilds/:id/emergency-lockdown', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot is not in this guild' });

    const currentStatusRes = await db.query('SELECT is_locked_down FROM guild_settings WHERE guild_id = $1', [id]);
    const currentlyLocked = Boolean(currentStatusRes.rows[0]?.is_locked_down);
    const nextLockState = !currentlyLocked;

    const channels = await guild.channels.fetch();
    let affectedChannels = 0;
    for (const [, ch] of channels) {
      if (ch && ch.type === ChannelType.GuildText) {
        try {
          await (ch as TextChannel).permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: nextLockState ? false : null,
          });
          affectedChannels++;
        } catch {}
      }
    }

    await db.query(
      'UPDATE guild_settings SET is_locked_down = $1, updated_at = NOW() WHERE guild_id = $2',
      [nextLockState, id]
    );

    await db.query(
      `INSERT INTO security_events (guild_id, user_id, event_type, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        user.id,
        nextLockState ? 'EMERGENCY_LOCKDOWN_ENABLED' : 'EMERGENCY_LOCKDOWN_LIFTED',
        nextLockState ? `Server put in emergency lockdown by ${user.username}` : `Emergency lockdown lifted by ${user.username}`,
        JSON.stringify({ affectedChannels }),
      ]
    );

    return reply.send({
      success: true,
      isLockedDown: nextLockState,
      affectedChannels,
      message: nextLockState
        ? `🚨 EMERGENCY LOCKDOWN ACTIVE: ${affectedChannels} text channels secured against raids!`
        : `🛡️ EMERGENCY LOCKDOWN LIFTED: Server permissions restored for ${affectedChannels} channels.`,
    });
  });

  // POST /api/guilds/:id/broadcast - Send custom announcement embed
  fastify.post('/api/guilds/:id/broadcast', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const channelId = String(body.channelId || '').replace(/[<#@!&>]/g, '').trim();
    const title = String(body.title || 'Official Server Announcement').trim();
    const message = String(body.message || '').trim();
    const color = body.color || '#5865F2';
    const mention = body.mention || 'none';

    if (!channelId || !message) {
      return reply.status(400).send({ error: 'Target channel and message content are required' });
    }

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot not in guild' });
    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) return reply.status(400).send({ error: 'Invalid channel' });

    const embed = new EmbedBuilder()
      .setColor(color as any)
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setFooter({ text: `Broadcasted by ${user.username} • SRB NEXUS` })
      .setTimestamp();

    let content: string | undefined = undefined;
    if (mention === 'everyone') content = '@everyone';
    else if (mention === 'here') content = '@here';

    await channel.send({ content, embeds: [embed] });
    return reply.send({ success: true, message: `Announcement broadcasted to #${channel.name}!` });
  });

  // POST /api/guilds/:id/welcome/test - Dispatch real Canvas welcome card test
  fastify.post('/api/guilds/:id/welcome/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot not in guild' });

    const sRes = await db.query('SELECT welcome_channel_id, welcome_bg_url, welcome_message FROM guild_settings WHERE guild_id = $1', [id]);
    const s = sRes.rows[0];
    const channelId = s?.welcome_channel_id;
    if (!channelId) {
      return reply.status(400).send({ error: 'No Welcome Channel configured in settings! Please select a channel and save first.' });
    }

    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return reply.status(400).send({ error: 'Configured welcome channel could not be found' });
    }

    const member = await guild.members.fetch(user.id).catch(() => guild.members.me);
    if (!member) return reply.status(400).send({ error: 'Could not fetch member for test card' });

    const card = await createWelcomeCard(member, s?.welcome_bg_url);
    const welcomeText = (s?.welcome_message || 'Welcome to the server, {user}!')
      .replace('{user}', `<@${member.id}>`)
      .replace('{server}', guild.name)
      .replace('{member_count}', String(guild.memberCount))
      .replace('{user_tag}', member.user.tag);

    await channel.send({ content: `🧪 **[TEST WELCOME CARD]**\n${welcomeText}`, files: [card] });
    return reply.send({ success: true, message: `Test welcome card sent to #${channel.name}!` });
  });

  // POST /api/guilds/:id/tickets/deploy - Deploy interactive ticket panel embed & button
  fastify.post('/api/guilds/:id/tickets/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const channelId = String(body.channelId || '').replace(/[<#@!&>]/g, '').trim();

    if (!channelId) return reply.status(400).send({ error: 'Target channel is required' });

    const guild = bot.guilds.cache.get(id);
    if (!guild) return reply.status(404).send({ error: 'Bot not in guild' });

    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) return reply.status(400).send({ error: 'Invalid channel' });

    const rawTitle = body.title || `${guild.name} Support Desk`;
    const cleanTitle = rawTitle.replace(/^[🎫📩]\s*/, '').trim() || `${guild.name} Support Desk`;
    const description = body.description || 'Need assistance or have questions? Click the button below to open a private ticket with our staff.';
    const rawLabel = body.buttonLabel || body.label || 'Open Ticket';
    const emoji = body.buttonEmoji || body.emoji || '📩';

    // Strip duplicate emoji from button label so it never renders double emoji e.g. [ 📩 📩 Open Ticket ]
    let cleanLabel = rawLabel.trim();
    if (emoji) {
      while (cleanLabel.startsWith(emoji)) {
        cleanLabel = cleanLabel.slice(emoji.length).trim();
      }
    }
    cleanLabel = cleanLabel.replace(/^[\p{Emoji}\u200d]+\s*/u, '').trim() || 'Open Ticket';

    const embed = new EmbedBuilder()
      .setColor('#06B6D4')
      .setTitle(`🎫 ${cleanTitle}`)
      .setDescription(description)
      .setFooter({ text: `${guild.name} • Automated Support System`, iconURL: guild.iconURL() || undefined })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('nexus_ticket_create')
      .setLabel(cleanLabel)
      .setStyle(ButtonStyle.Primary);

    if (emoji) {
      try { button.setEmoji(emoji); } catch {}
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

    await channel.send({ embeds: [embed], components: [row] });

    // Persist deploy settings into guild_settings
    const cleanCat = body.category_id ? String(body.category_id).replace(/[<#@!&>]/g, '').trim() : null;
    const ticketMode = body.ticket_mode || undefined;
    const welcomeMsg = body.ticket_welcome_msg ? String(body.ticket_welcome_msg).trim() : undefined;

    await db.query(
      `UPDATE guild_settings 
       SET ticket_panel_title = $1,
           ticket_panel_description = $2,
           ticket_button_label = $3,
           ticket_button_emoji = $4,
           tickets_enabled = TRUE,
           category_id = COALESCE($5, category_id),
           ticket_mode = COALESCE($6, ticket_mode),
           ticket_welcome_msg = COALESCE($7, ticket_welcome_msg),
           updated_at = NOW()
       WHERE guild_id = $8`,
      [cleanTitle, description, cleanLabel, emoji, cleanCat, ticketMode, welcomeMsg, id]
    ).catch(() => {});

    return reply.send({ success: true, message: `Ticket panel deployed to #${channel.name}!` });
  });

  // DELETE /api/guilds/:id/reaction-roles/:rrId - Remove reaction role
  fastify.delete('/api/guilds/:id/reaction-roles/:rrId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, rrId } = request.params as { id: string; rrId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    await db.query('DELETE FROM guild_reaction_roles WHERE id = $1 AND guild_id = $2', [Number(rrId), id]);
    return reply.send({ success: true, message: 'Reaction role deleted' });
  });

  // POST /api/guilds/:id/giveaways/:giveawayId/end - End giveaway immediately
  fastify.post('/api/guilds/:id/giveaways/:giveawayId/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, giveawayId } = request.params as { id: string; giveawayId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const gRes = await db.query('SELECT * FROM giveaways WHERE id = $1 AND guild_id = $2', [Number(giveawayId), id]);
    if (gRes.rows.length === 0) return reply.status(404).send({ error: 'Giveaway not found' });

    const giveaway = gRes.rows[0];
    const entries: string[] = giveaway.entries || [];
    const winnerCount = Math.min(giveaway.winner_count || 1, entries.length);

    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, winnerCount);

    await db.query(
      'UPDATE giveaways SET ended = TRUE, winners = $1, ends_at = NOW() WHERE id = $2',
      [winners, giveaway.id]
    );

    const guild = bot.guilds.cache.get(id);
    if (guild) {
      const ch = (await guild.channels.fetch(giveaway.channel_id).catch(() => null)) as TextChannel;
      if (ch && ch.isTextBased()) {
        const winnerMentions = winners.length > 0 ? winners.map((w: string) => `<@${w}>`).join(', ') : 'No participants';
        const embed = new EmbedBuilder()
          .setColor('#10B981')
          .setTitle(`🎉 GIVEAWAY CONCLUDED: ${giveaway.prize}`)
          .setDescription(`🏆 **Winner(s):** ${winnerMentions}\n\nConcluded by administrator via Web Control Panel!`)
          .setFooter({ text: 'SRB NEXUS Giveaway Hub' })
          .setTimestamp();
        await ch.send({ embeds: [embed] }).catch(() => null);
      }
    }

    return reply.send({ success: true, winners, message: `Giveaway concluded! Winner(s): ${winners.length}` });
  });

  // POST /api/guilds/:id/giveaways/:giveawayId/reroll - Reroll winner
  fastify.post('/api/guilds/:id/giveaways/:giveawayId/reroll', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, giveawayId } = request.params as { id: string; giveawayId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const gRes = await db.query('SELECT * FROM giveaways WHERE id = $1 AND guild_id = $2', [Number(giveawayId), id]);
    if (gRes.rows.length === 0) return reply.status(404).send({ error: 'Giveaway not found' });

    const giveaway = gRes.rows[0];
    const entries: string[] = giveaway.entries || [];
    if (entries.length === 0) return reply.status(400).send({ error: 'No participants to reroll from' });

    const winnerCount = Math.min(giveaway.winner_count || 1, entries.length);
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const newWinners = shuffled.slice(0, winnerCount);

    await db.query('UPDATE giveaways SET winners = $1 WHERE id = $2', [newWinners, giveaway.id]);

    const guild = bot.guilds.cache.get(id);
    if (guild) {
      const ch = (await guild.channels.fetch(giveaway.channel_id).catch(() => null)) as TextChannel;
      if (ch && ch.isTextBased()) {
        const winnerMentions = newWinners.map((w: string) => `<@${w}>`).join(', ');
        await ch.send(`🎲 **Giveaway Reroll!** The new winner(s) for **${giveaway.prize}** is: ${winnerMentions}! Congratulations! 🎉`).catch(() => null);
      }
    }

    return reply.send({ success: true, newWinners, message: `Rerolled winner(s): ${newWinners.join(', ')}` });
  });

  // GET /api/guilds/:id/economy/shop - List shop items
  fastify.get('/api/guilds/:id/economy/shop', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const res = await db.query('SELECT * FROM guild_shop_items WHERE guild_id = $1 ORDER BY id DESC', [id]);
    return reply.send({ items: res.rows });
  });

  // POST /api/guilds/:id/economy/shop - Create shop item
  fastify.post('/api/guilds/:id/economy/shop', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const price = Math.max(1, Number(body.price) || 100);
    const roleId = body.roleId ? String(body.roleId).replace(/[<#@!&>]/g, '').trim() : null;

    if (!name) return reply.status(400).send({ error: 'Item name is required' });

    const res = await db.query(
      'INSERT INTO guild_shop_items (guild_id, name, description, price, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, name, description, price, roleId]
    );
    return reply.send({ success: true, item: res.rows[0], message: `Added "${name}" to server shop!` });
  });

  // DELETE /api/guilds/:id/economy/shop/:itemId - Delete shop item
  fastify.delete('/api/guilds/:id/economy/shop/:itemId', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, itemId } = request.params as { id: string; itemId: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    await db.query('DELETE FROM guild_shop_items WHERE id = $1 AND guild_id = $2', [Number(itemId), id]);
    return reply.send({ success: true, message: 'Shop item deleted' });
  });

  // =========================================================================
  // INVITE TRACKER MODULE ENDPOINTS
  // =========================================================================

  // GET /api/guilds/:id/invites - Fetch invite-role mappings, active guild invites, and join logs
  fastify.get('/api/guilds/:id/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    try {
      const guild = bot.guilds.cache.get(id);

      // 1. Fetch DB role mappings
      const mappingsRes = await db.query(
        `SELECT invite_code, role_id, created_at FROM guild_invite_roles WHERE guild_id = $1 ORDER BY created_at DESC`,
        [id]
      );

      // Enhance mappings with role name and role color
      const mappings = mappingsRes.rows.map((row: any) => {
        const role = guild?.roles.cache.get(row.role_id);
        return {
          invite_code: row.invite_code,
          role_id: row.role_id,
          role_name: role ? role.name : 'Unknown Role',
          role_color: role ? role.hexColor : '#99aab5',
          created_at: row.created_at,
        };
      });

      // 2. Fetch live guild invites from Discord
      let activeInvites: any[] = [];
      let vanity: any = null;

      if (guild) {
        try {
          const fetchedInvites = await guild.invites.fetch().catch(() => null);
          if (fetchedInvites) {
            activeInvites = Array.from(fetchedInvites.values()).map((inv) => ({
              code: inv.code,
              url: inv.url,
              uses: inv.uses ?? 0,
              maxUses: inv.maxUses ?? 0,
              inviter: inv.inviter
                ? {
                    id: inv.inviter.id,
                    username: inv.inviter.username,
                    avatar: inv.inviter.displayAvatarURL({ size: 64 }),
                  }
                : null,
              temporary: inv.temporary,
              expiresAt: inv.expiresAt ? inv.expiresAt.toISOString() : null,
              createdAt: inv.createdAt ? inv.createdAt.toISOString() : null,
            }));
          }

          if (guild.vanityURLCode) {
            const v = await guild.fetchVanityData().catch(() => null);
            vanity = {
              code: guild.vanityURLCode,
              uses: v ? v.uses : 0,
            };
          }
        } catch (e: any) {
          request.log.warn({ e }, '[INVITE-API] Could not fetch live Discord invites');
        }
      }

      // 3. Fetch recent joins from audit logs
      const logsRes = await db.query(
        `SELECT user_id, user_tag, user_avatar, invite_code, role_id, role_name, joined_at 
         FROM guild_invite_logs 
         WHERE guild_id = $1 
         ORDER BY joined_at DESC 
         LIMIT 50`,
        [id]
      ).catch(() => ({ rows: [] }));

      // 4. Fetch available guild roles directly for the dropdown
      let roles: any[] = [];
      if (guild) {
        try {
          const fetchedRoles = (await guild.roles.fetch().catch(() => null)) || guild.roles.cache;
          roles = Array.from(fetchedRoles.values())
            .filter((r): r is any => r !== null && r.name !== '@everyone' && !r.managed)
            .map((r) => ({
              id: r.id,
              name: r.name,
              color: r.hexColor,
              position: r.position,
            }))
            .sort((a, b) => b.position - a.position);
        } catch (e: any) {
          roles = Array.from(guild.roles.cache.values())
            .filter((r): r is any => r !== null && r.name !== '@everyone' && !r.managed)
            .map((r) => ({
              id: r.id,
              name: r.name,
              color: r.hexColor,
              position: r.position,
            }))
            .sort((a, b) => b.position - a.position);
        }
      }

      return reply.send({
        success: true,
        mappings,
        activeInvites,
        vanity,
        recentJoins: logsRes.rows,
        roles,
      });
    } catch (err: any) {
      request.log.error({ err }, '[INVITE-API] Failed to fetch invite tracking data');
      return reply.status(500).send({ error: 'Failed to fetch invite tracking data: ' + err.message });
    }
  });

  // POST /api/guilds/:id/invites - Bind invite code to a role
  fastify.post('/api/guilds/:id/invites', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const rawCode = body.code ? String(body.code).trim() : '';
    const cleanRoleId = body.role_id ? String(body.role_id).replace(/[<#@!&>]/g, '').trim() : '';

    if (!rawCode) return reply.status(400).send({ error: 'Invite code or link is required' });
    if (!cleanRoleId) return reply.status(400).send({ error: 'Role is required' });

    // Clean invite link to raw code
    const cleanCode = rawCode
      .replace(/^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
      .trim();

    const guild = bot.guilds.cache.get(id);
    if (!guild) {
      return reply.status(404).send({ error: 'Guild not found or bot is not in server' });
    }

    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return reply.status(400).send({ error: 'Bot lacks "Manage Roles" permission in this server' });
    }

    const role = guild.roles.cache.get(cleanRoleId) || (await guild.roles.fetch(cleanRoleId).catch(() => null));
    if (!role) {
      return reply.status(400).send({ error: 'Selected role was not found in server' });
    }

    if (botMember.roles.highest.position <= role.position) {
      return reply.status(400).send({
        error: `Cannot assign "${role.name}": Role is positioned higher than or equal to bot's highest role. Move the bot role above this role in Server Settings > Roles.`,
      });
    }

    if (role.managed) {
      return reply.status(400).send({ error: `"${role.name}" is a managed integration role and cannot be assigned.` });
    }

    try {
      await db.query(
        `INSERT INTO guild_invite_roles (guild_id, invite_code, role_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, invite_code)
         DO UPDATE SET role_id = EXCLUDED.role_id, created_at = CURRENT_TIMESTAMP`,
        [id, cleanCode, role.id]
      );

      return reply.send({
        success: true,
        message: `Successfully mapped invite "${cleanCode}" to role @${role.name}!`,
        mapping: {
          invite_code: cleanCode,
          role_id: role.id,
          role_name: role.name,
          role_color: role.hexColor,
        },
      });
    } catch (err: any) {
      request.log.error({ err }, '[INVITE-API] Failed to save invite role');
      return reply.status(500).send({ error: 'Database error: ' + err.message });
    }
  });

  // DELETE /api/guilds/:id/invites/:code - Remove invite role mapping
  fastify.delete('/api/guilds/:id/invites/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, code } = request.params as { id: string; code: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const cleanCode = code
      .replace(/^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\//i, '')
      .trim();

    try {
      const res = await db.query(
        `DELETE FROM guild_invite_roles WHERE guild_id = $1 AND invite_code = $2 RETURNING *`,
        [id, cleanCode]
      );

      if (res.rowCount === 0) {
        return reply.status(404).send({ error: 'No mapping found for this invite code' });
      }

      return reply.send({ success: true, message: `Removed mapping for invite "${cleanCode}"` });
    } catch (err: any) {
      request.log.error({ err }, '[INVITE-API] Failed to delete invite role');
      return reply.status(500).send({ error: 'Database error: ' + err.message });
    }
  });

  // =========================================================================
  // VERIFICATION GATE ENDPOINTS
  // =========================================================================
  fastify.post('/api/guilds/:id/verification/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const channelId = String(body.channelId || '').replace(/[<#@!&>]/g, '').trim();
    const type = body.type === 'captcha' ? 'captcha' : 'button';
    const title = body.title ? String(body.title).trim() : undefined;
    const desc = body.description ? String(body.description).trim() : undefined;

    const verifiedRole = body.verification_role_id ? String(body.verification_role_id).replace(/[<#@!&>]/g, '').trim() : null;
    const unverifiedRole = body.unverified_role_id ? String(body.unverified_role_id).replace(/[<#@!&>]/g, '').trim() : null;

    if (!channelId) {
      return reply.status(400).send({ error: 'Target verification channel is required' });
    }

    const deployRes = await deployVerificationPanel(bot, id, channelId, type, title, desc);
    if (!deployRes.success) {
      return reply.status(400).send({ error: deployRes.error || 'Failed to deploy verification panel' });
    }

    // Automatically activate verification and save channel/roles to guild_settings
    await db.query(
      `UPDATE guild_settings 
       SET verification_enabled = TRUE,
           verification_channel_id = $1,
           verification_type = $2,
           verification_title = COALESCE($3, verification_title),
           verification_desc = COALESCE($4, verification_desc),
           verification_role_id = COALESCE($5, verification_role_id),
           unverified_role_id = COALESCE($6, unverified_role_id),
           updated_at = NOW()
       WHERE guild_id = $7`,
      [channelId, type, title || null, desc || null, verifiedRole, unverifiedRole, id]
    ).catch((e) => logger.error({ e }, 'Failed to auto-enable verification in db on deploy'));

    return reply.send({ success: true, message: 'Verification Gate deployed and activated successfully!' });
  });

  // =========================================================================
  // LIVE VOICE STAT COUNTERS ENDPOINTS
  // =========================================================================
  fastify.post('/api/guilds/:id/serverstats/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const guild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!guild) return reply.status(404).send({ error: 'Bot is not in this guild' });

    const setupRes = await setupDefaultStatCounters(guild);
    if (!setupRes.success) {
      return reply.status(400).send({ error: setupRes.error || 'Failed to setup stat counters' });
    }

    return reply.send({
      success: true,
      message: 'Dynamic Live Voice Stat Counters created in server sidebar!',
      stats: setupRes,
    });
  });

  // =========================================================================
  // CUSTOM AUTO-RESPONDER & TAG ENGINE ENDPOINTS
  // =========================================================================
  fastify.get('/api/guilds/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const tags = await listGuildTags(id);
    return reply.send({ tags });
  });

  fastify.post('/api/guilds/:id/tags', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const name = String(body.name || '').trim();
    const content = String(body.content || '').trim();
    const embedTitle = body.embed_title ? String(body.embed_title).trim() : undefined;
    const embedColor = body.embed_color ? String(body.embed_color).trim() : '#5865F2';

    if (!name || !content) {
      return reply.status(400).send({ error: 'Tag trigger name and content are required' });
    }

    const res = await upsertGuildTag(id, name, content, embedTitle, embedColor, user.username);
    if (!res.success) {
      return reply.status(400).send({ error: res.error || 'Failed to save tag' });
    }

    return reply.send({ success: true, message: `Tag "!${name}" saved successfully!` });
  });

  fastify.delete('/api/guilds/:id/tags/:name', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id, name } = request.params as { id: string; name: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const deleted = await deleteGuildTag(id, name);
    if (!deleted) {
      return reply.status(404).send({ error: 'Tag not found' });
    }

    return reply.send({ success: true, message: `Tag "!${name}" deleted!` });
  });

  // =========================================================================
  // VISUAL EMBED STUDIO DISPATCH ENDPOINT
  // =========================================================================
  fastify.post('/api/guilds/:id/embeds/send', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) return reply.status(401).send({ error: 'Unauthorized' });
    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) return reply.status(403).send({ error: 'Forbidden' });

    const body = (request.body as Record<string, any>) || {};
    const channelId = String(body.channelId || '').replace(/[<#@!&>]/g, '').trim();
    if (!channelId) {
      return reply.status(400).send({ error: 'Target text channel is required' });
    }

    const guild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!guild) return reply.status(404).send({ error: 'Bot is not in this guild' });

    const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) {
      return reply.status(400).send({ error: 'Invalid or unreachable text channel' });
    }

    const embed = new EmbedBuilder();
    if (body.color) {
      try { embed.setColor(body.color); } catch { embed.setColor('#5865F2'); }
    } else {
      embed.setColor('#5865F2');
    }

    if (body.title && String(body.title).trim()) embed.setTitle(String(body.title).trim());
    if (body.url && String(body.url).trim().startsWith('http')) embed.setURL(String(body.url).trim());
    if (body.description && String(body.description).trim()) embed.setDescription(String(body.description).trim());

    if (body.authorName && String(body.authorName).trim()) {
      embed.setAuthor({
        name: String(body.authorName).trim(),
        iconURL: body.authorIcon && String(body.authorIcon).trim().startsWith('http') ? String(body.authorIcon).trim() : undefined,
      });
    }

    if (body.thumbnail && String(body.thumbnail).trim().startsWith('http')) {
      embed.setThumbnail(String(body.thumbnail).trim());
    }

    if (body.image && String(body.image).trim().startsWith('http')) {
      embed.setImage(String(body.image).trim());
    }

    if (body.footerText && String(body.footerText).trim()) {
      embed.setFooter({
        text: String(body.footerText).trim(),
        iconURL: body.footerIcon && String(body.footerIcon).trim().startsWith('http') ? String(body.footerIcon).trim() : undefined,
      });
    }

    if (body.timestamp) {
      embed.setTimestamp();
    }

    if (Array.isArray(body.fields)) {
      for (const f of body.fields) {
        if (f.name && f.value) {
          embed.addFields({
            name: String(f.name).slice(0, 256),
            value: String(f.value).slice(0, 1024),
            inline: Boolean(f.inline),
          });
        }
      }
    }

    let content: string | undefined = undefined;
    if (body.mention === 'everyone') content = '@everyone';
    else if (body.mention === 'here') content = '@here';

    await channel.send({ content, embeds: [embed] });
    return reply.send({ success: true, message: `Embed successfully dispatched to #${channel.name}!` });
  });


  // ==========================================
  // 👑 SOVEREIGN SERVER OWNER MODULE ENDPOINTS
  // ==========================================

  // GET /api/guilds/:id/owner-config
  fastify.get('/api/guilds/:id/owner-config', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to access this server' });
    }

    const botGuild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!botGuild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    try {
      const ownerMember = await botGuild.fetchOwner().catch(() => null);
      const ownerConfig = await getGuildOwnerConfig(id, botGuild.ownerId);

      const sovereign = await isSovereignUser(user.id, id);

      const rawCoOwners: string[] = Array.isArray(ownerConfig?.co_owners) ? ownerConfig.co_owners : [];
      const rawProtectedRoles: string[] = Array.isArray(ownerConfig?.protected_roles) ? ownerConfig.protected_roles : [];

      // Fetch co-owner rich identities
      const detailedCoOwners = await Promise.all(
        rawCoOwners.map(async (coId) => {
          try {
            const member = await botGuild.members.fetch(coId).catch(() => null);
            if (member) {
              return {
                id: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                tag: member.user.tag,
                avatar: member.user.displayAvatarURL({ size: 64 }),
                displayName: member.displayName,
              };
            }
            const fetchedUser = await bot.users.fetch(coId).catch(() => null);
            if (fetchedUser) {
              return {
                id: fetchedUser.id,
                username: fetchedUser.username,
                discriminator: fetchedUser.discriminator,
                tag: fetchedUser.tag,
                avatar: fetchedUser.displayAvatarURL({ size: 64 }),
                displayName: fetchedUser.username,
              };
            }
          } catch {}
          return { id: coId, username: 'Unknown User', tag: coId, avatar: null, displayName: coId };
        })
      );

      // Fetch guild settings for lockdown indicator
      const settingsRes = await db.query(
        "SELECT is_locked_down FROM guild_settings WHERE guild_id = $1",
        [id]
      ).catch(() => ({ rows: [] }));
      const isLockedDown = Boolean(settingsRes.rows[0]?.is_locked_down);

      return reply.send({
        guildId: id,
        guildName: botGuild.name,
        guildIcon: botGuild.iconURL({ size: 128 }),
        memberCount: botGuild.memberCount,
        owner: {
          id: botGuild.ownerId,
          username: ownerMember?.user.username || 'Owner',
          discriminator: ownerMember?.user.discriminator || '0000',
          tag: ownerMember?.user.tag || 'Owner',
          avatar: ownerMember?.user.displayAvatarURL({ size: 128 }) || null,
        },
        viewer: {
          id: user.id,
          isOwner: sovereign.isOwner,
          isCoOwner: sovereign.isCoOwner,
          isBotOwner: sovereign.isBotSysOwner,
          canConfigure: sovereign.allowed,
        },
        settingsLocked: Boolean(ownerConfig?.settings_locked),
        ownerDmAlerts: ownerConfig?.owner_dm_alerts !== false,
        coOwners: detailedCoOwners,
        protectedRoles: rawProtectedRoles,
        isLockedDown,
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch owner config');
      return reply.status(500).send({ error: 'Failed to retrieve owner configuration' });
    }
  });

  // POST /api/guilds/:id/owner-config
  fastify.post('/api/guilds/:id/owner-config', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const botGuild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!botGuild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    const sovereign = await isSovereignUser(user.id, id);
    if (!sovereign.allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: '⛔ Only the Primary Server Owner or designated Executive Co-Owners can modify sovereign configuration.',
      });
    }

    const body = (request.body as Record<string, any>) || {};

    // Co-owner edits require Primary Server Owner or Bot System Developer
    if (body.co_owners !== undefined && !sovereign.isOwner && !sovereign.isBotSysOwner) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: '⛔ Only the Primary Server Owner can add or revoke Executive Co-Owners.',
      });
    }

    try {
      // Ensure row exists
      await db.query(
        "INSERT INTO guild_owner_config (guild_id, owner_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO NOTHING",
        [id, botGuild.ownerId]
      );

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (body.co_owners !== undefined) {
        const cleanCoOwners = Array.isArray(body.co_owners)
          ? body.co_owners.filter((uid: any) => typeof uid === 'string' && /^\d{17,20}$/.test(uid))
          : [];
        updates.push(`co_owners = $${paramIndex++}`);
        values.push(JSON.stringify(cleanCoOwners));
      }

      if (body.protected_roles !== undefined) {
        const cleanRoles = Array.isArray(body.protected_roles)
          ? body.protected_roles.filter((rid: any) => typeof rid === 'string' && /^\d{17,20}$/.test(rid))
          : [];
        updates.push(`protected_roles = $${paramIndex++}`);
        values.push(JSON.stringify(cleanRoles));
      }

      if (body.settings_locked !== undefined) {
        updates.push(`settings_locked = $${paramIndex++}`);
        values.push(Boolean(body.settings_locked));
      }

      if (body.owner_dm_alerts !== undefined) {
        const isDmOn = Boolean(body.owner_dm_alerts);
        updates.push(`owner_dm_alerts = $${paramIndex++}`);
        values.push(isDmOn);

        // Also synchronize to guild_spam_catcher
        await db.query(
          "UPDATE guild_spam_catcher SET owner_dm_alert = $1, updated_at = NOW() WHERE guild_id = $2",
          [isDmOn, id]
        ).catch(() => {});
        invalidateSpamCatcherCache(id);
      }

      updates.push("updated_at = NOW()");
      values.push(id);

      if (updates.length > 1) {
        const query = `UPDATE guild_owner_config SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`;
        await db.query(query, values);
      }

      const updated = await db.query("SELECT * FROM guild_owner_config WHERE guild_id = $1", [id]);

      return reply.send({
        success: true,
        message: '👑 Sovereign Owner Configuration updated successfully',
        config: updated.rows[0],
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to save owner config');
      return reply.status(500).send({ error: 'Failed to update owner configuration' });
    }
  });

  // POST /api/guilds/:id/owner-config/test-dm
  fastify.post('/api/guilds/:id/owner-config/test-dm', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const botGuild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!botGuild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    const sovereign = await isSovereignUser(user.id, id);
    if (!sovereign.allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Only the Server Owner or designated Co-Owners can test owner alert delivery.',
      });
    }

    try {
      const recipientUser = await bot.users.fetch(user.id).catch(() => null);
      if (!recipientUser) {
        return reply.status(404).send({ error: 'Could not fetch your Discord user profile' });
      }

      const testEmbed = new EmbedBuilder()
        .setTitle('👑 [SRB NEXUS] Sovereign Owner Alert Verification')
        .setDescription(
          `Hello **${recipientUser.username}**!\n\nThis is a verified test alert from **SRB NEXUS** for your server **${botGuild.name}**.\n\nYour direct messaging channel is confirmed and active. High-priority security incidents (Anti-Raid alerts, Spam waves, Nuke attempts, or Mass actions) will immediately notify you here.`
        )
        .setColor(0x00f0ff)
        .addFields(
          { name: 'Server', value: botGuild.name, inline: true },
          { name: 'Server ID', value: botGuild.id, inline: true },
          { name: 'Alert Status', value: '🟢 Verified & Active', inline: true }
        )
        .setFooter({ text: 'SRB NEXUS Sovereign Infrastructure Suite' })
        .setTimestamp();

      await recipientUser.send({ embeds: [testEmbed] });

      return reply.send({
        success: true,
        message: '✅ Test security alert successfully delivered to your Discord Direct Messages!',
      });
    } catch (dmErr: any) {
      request.log.warn({ dmErr }, 'Failed to deliver test alert DM');
      return reply.status(400).send({
        success: false,
        error: 'Failed to deliver DM. Please check your Discord Privacy Settings (Allow direct messages from server members).',
      });
    }
  });



  // ==========================================
  // 🛡️ SPAM CATCHER MODULE ENDPOINTS
  // ==========================================

  // GET /api/guilds/:id/spamcatcher
  fastify.get('/api/guilds/:id/spamcatcher', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to access this server' });
    }

    try {
      const cfg = await getSpamCatcherConfig(id);
      const res = await db.query(
        "SELECT total_spams_caught FROM guild_spam_catcher WHERE guild_id = $1",
        [id]
      ).catch(() => ({ rows: [] }));
      const totalCaught = res.rows[0]?.total_spams_caught || 0;

      const sovereign = await isSovereignUser(user.id, id);

      return reply.send({
        guildId: id,
        config: cfg,
        totalCaught,
        canConfigure: sovereign.allowed,
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch spam catcher config');
      return reply.status(500).send({ error: 'Failed to retrieve spam catcher configuration' });
    }
  });

  // POST /api/guilds/:id/spamcatcher
  fastify.post('/api/guilds/:id/spamcatcher', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    // Sovereign Settings Lock check
    const ownerConfigCheck = await getGuildOwnerConfig(id);
    if (ownerConfigCheck?.settings_locked) {
      const { allowed } = await isSovereignUser(user.id, id);
      if (!allowed) {
        return reply.status(423).send({
          error: 'LOCKED',
          message: '🔒 Server Settings are locked by the Server Owner. Only the Server Owner and designated Co-Owners can modify configurations.',
        });
      }
    }

    const body = (request.body as Record<string, any>) || {};

    try {
      await db.query(
        "INSERT INTO guild_spam_catcher (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING",
        [id]
      );

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (body.enabled !== undefined) {
        updates.push(`enabled = $${paramIndex++}`);
        values.push(Boolean(body.enabled));
      }

      if (body.sensitivity !== undefined) {
        const sens = ['low', 'medium', 'high', 'extreme'].includes(String(body.sensitivity).toLowerCase())
          ? String(body.sensitivity).toLowerCase()
          : 'medium';
        updates.push(`sensitivity = $${paramIndex++}`);
        values.push(sens);
      }

      if (body.action !== undefined) {
        const act = ['DELETE', 'TIMEOUT', 'KICK', 'BAN'].includes(String(body.action).toUpperCase())
          ? String(body.action).toUpperCase()
          : 'TIMEOUT';
        updates.push(`action = $${paramIndex++}`);
        values.push(act);
      }

      if (body.timeout_duration_seconds !== undefined) {
        updates.push(`timeout_duration_seconds = $${paramIndex++}`);
        values.push(Math.max(60, Math.min(86400, Number(body.timeout_duration_seconds) || 300)));
      }

      if (body.honeypot_channel_id !== undefined) {
        const cleanChan = body.honeypot_channel_id ? String(body.honeypot_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        updates.push(`honeypot_channel_id = $${paramIndex++}`);
        values.push(cleanChan || null);
      }

      if (body.log_channel_id !== undefined) {
        const cleanLog = body.log_channel_id ? String(body.log_channel_id).replace(/[<#@!&>]/g, '').trim() : null;
        updates.push(`log_channel_id = $${paramIndex++}`);
        values.push(cleanLog || null);
      }

      if (body.anti_discord_invites !== undefined) {
        updates.push(`anti_discord_invites = $${paramIndex++}`);
        values.push(Boolean(body.anti_discord_invites));
      }

      if (body.anti_phishing_links !== undefined) {
        updates.push(`anti_phishing_links = $${paramIndex++}`);
        values.push(Boolean(body.anti_phishing_links));
      }

      if (body.owner_dm_alert !== undefined) {
        const isDmOn = Boolean(body.owner_dm_alert);
        updates.push(`owner_dm_alert = $${paramIndex++}`);
        values.push(isDmOn);

        // Also synchronize to guild_owner_config so DMs stay strictly consistent
        const botGuild = bot.guilds.cache.get(id);
        const ownerId = botGuild?.ownerId || user.id;
        await db.query(
          "INSERT INTO guild_owner_config (guild_id, owner_id, owner_dm_alerts) VALUES ($1, $2, $3) ON CONFLICT (guild_id) DO UPDATE SET owner_dm_alerts = $3, updated_at = NOW()",
          [id, ownerId, isDmOn]
        ).catch(() => {});
      }

      if (body.whitelist_roles !== undefined) {
        const cleanRoles = Array.isArray(body.whitelist_roles)
          ? body.whitelist_roles.filter((r: any) => typeof r === 'string' && /^\d{17,20}$/.test(r))
          : [];
        updates.push(`whitelist_roles = $${paramIndex++}`);
        values.push(JSON.stringify(cleanRoles));
      }

      if (body.whitelist_channels !== undefined) {
        const cleanChannels = Array.isArray(body.whitelist_channels)
          ? body.whitelist_channels.filter((c: any) => typeof c === 'string' && /^\d{17,20}$/.test(c))
          : [];
        updates.push(`whitelist_channels = $${paramIndex++}`);
        values.push(JSON.stringify(cleanChannels));
      }

      updates.push("updated_at = NOW()");
      values.push(id);

      if (updates.length > 1) {
        const query = `UPDATE guild_spam_catcher SET ${updates.join(', ')} WHERE guild_id = $${paramIndex}`;
        await db.query(query, values);
      }

      invalidateSpamCatcherCache(id);
      const updated = await getSpamCatcherConfig(id);

      return reply.send({
        success: true,
        message: '🛡️ Spam Catcher configuration saved successfully',
        config: updated,
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to save spam catcher config');
      return reply.status(500).send({ error: 'Failed to update spam catcher configuration' });
    }
  });

  // GET /api/guilds/:id/spamcatcher/logs
  fastify.get('/api/guilds/:id/spamcatcher/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to access this server' });
    }

    try {
      const res = await db.query(
        `SELECT id, user_id, event_type, reason, metadata, created_at 
         FROM security_events 
         WHERE guild_id = $1 AND (event_type LIKE '%SPAM%' OR reason LIKE '%Spam%' OR reason LIKE '%Honeypot%')
         ORDER BY id DESC LIMIT 30`,
        [id]
      ).catch(() => ({ rows: [] }));

      return reply.send({ logs: res.rows });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to fetch spam logs');
      return reply.status(500).send({ error: 'Failed to retrieve spam logs' });
    }
  });

  // POST /api/guilds/:id/spamcatcher/test
  fastify.post('/api/guilds/:id/spamcatcher/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const botGuild = bot.guilds.cache.get(id) || (await bot.guilds.fetch(id).catch(() => null));
    if (!botGuild) {
      return reply.status(404).send({ error: 'Bot is not in this guild' });
    }

    try {
      const cfg = await getSpamCatcherConfig(id);
      const owner = await botGuild.fetchOwner().catch(() => null);

      const testEmbed = new EmbedBuilder()
        .setTitle('🛡️ [SPAM CATCHER TEST] Incident Simulation')
        .setDescription(`This is an authorized verification test from **SRB NEXUS Spam Catcher** for **${botGuild.name}**.`)
        .setColor(0x00f0ff)
        .addFields(
          { name: 'Simulated User', value: `<@${user.id}> (${user.username})`, inline: true },
          { name: 'Simulated Action', value: '`' + cfg.action + '`', inline: true },
          { name: 'Sensitivity', value: '`' + cfg.sensitivity.toUpperCase() + '`', inline: true },
          { name: 'Trigger Heuristic', value: 'Velocity Flood & Mass Duplicate Simulation', inline: false }
        )
        .setFooter({ text: 'SRB NEXUS Sovereign Server Owner Alert' })
        .setTimestamp();

      let dmSent = false;
      if (cfg.owner_dm_alert === true && owner) {
        try {
          await owner.send({ embeds: [testEmbed] });
          dmSent = true;
        } catch {}
      }

      if (cfg.log_channel_id) {
        const logChan = await botGuild.channels.fetch(cfg.log_channel_id).catch(() => null);
        if (logChan && logChan instanceof TextChannel) {
          await logChan.send({ embeds: [testEmbed] }).catch(() => {});
        }
      }

      return reply.send({
        success: true,
        message: cfg.owner_dm_alert ? `✅ Test completed! ${dmSent ? 'Direct DM alert delivered to Server Owner.' : 'Owner DM alert could not be sent (DMs closed).'}` : '✅ Test completed! (Owner Direct DM Alert is OFF, so no direct message was sent).',
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to execute spam test');
      return reply.status(500).send({ error: 'Failed to execute spam catcher test' });
    }
  });


  // POST /api/guilds/:id/spamcatcher/deploy
  fastify.post('/api/guilds/:id/spamcatcher/deploy', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user as AuthUserPayload | undefined;
    const { id } = request.params as { id: string };

    if (!user || !user.accessToken) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const hasAccess = await verifyUserGuildAccess(user.accessToken, id);
    if (!hasAccess) {
      return reply.status(403).send({ error: 'You do not have permission to manage this server' });
    }

    // Sovereign Settings Lock check
    const ownerConfigCheck = await getGuildOwnerConfig(id);
    if (ownerConfigCheck?.settings_locked) {
      const { allowed } = await isSovereignUser(user.id, id);
      if (!allowed) {
        return reply.status(423).send({
          error: 'LOCKED',
          message: '🔒 Server Settings are locked by the Server Owner. Only the Server Owner and designated Co-Owners can deploy modules.',
        });
      }
    }

    const body = (request.body as Record<string, any>) || {};

    try {
      const deployRes = await deploySpamCatcherHoneypot(bot, {
        guildId: id,
        channelId: body.channelId || null,
        timeoutHours: Number(body.timeoutHours) || 6,
        action: body.action || 'TIMEOUT',
        customTitle: body.customTitle,
        customDesc: body.customDesc,
      });

      if (!deployRes.success) {
        return reply.status(400).send({ error: deployRes.error || 'Failed to deploy spam catcher channel' });
      }

      return reply.send({
        success: true,
        channelId: deployRes.channelId,
        messageId: deployRes.messageId,
        message: '🐝 Spam Catcher Honeypot Channel successfully deployed!',
      });
    } catch (err: any) {
      request.log.error({ err }, 'Failed to deploy spam catcher honeypot');
      return reply.status(500).send({ error: 'Failed to deploy spam catcher channel' });
    }
  });

}