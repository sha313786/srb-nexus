import {
  Client,
  Guild,
  ChannelType,
  PermissionFlagsBits,
  VoiceChannel,
  CategoryChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

// Rate limit tracker: guildId -> lastUpdateTime (timestamp)
const lastStatsUpdate = new Map<string, number>();
const UPDATE_COOLDOWN_MS = 6 * 60 * 1000; // 6 minutes (Discord allows max 2 edits / 10 min)

/**
 * Update or deploy live voice stat counters for a guild
 */
export async function updateGuildVoiceStats(guild: Guild, force = false): Promise<void> {
  const now = Date.now();
  const lastUpdate = lastStatsUpdate.get(guild.id) || 0;

  if (!force && now - lastUpdate < UPDATE_COOLDOWN_MS) {
    return; // Throttled to avoid Discord channel rename 429 rate limits
  }

  try {
    const res = await db.query(
      `SELECT stat_counters_enabled, stat_category_id, stat_channel_members, stat_channel_online, stat_channel_bots 
       FROM guild_settings WHERE guild_id = $1`,
      [guild.id]
    );

    if (res.rows.length === 0 || !res.rows[0].stat_counters_enabled) {
      return;
    }

    const {
      stat_category_id,
      stat_channel_members,
      stat_channel_online,
      stat_channel_bots,
    } = res.rows[0];

    // Fetch members if not fully cached
    await guild.members.fetch().catch(() => {});

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    // Approximate online count from member presences
    const onlineCount = guild.members.cache.filter(
      (m) => m.presence && m.presence.status !== 'offline'
    ).size;

    lastStatsUpdate.set(guild.id, now);

    // Update Members Channel
    if (stat_channel_members) {
      const ch = guild.channels.cache.get(stat_channel_members);
      if (ch && ch.type === ChannelType.GuildVoice) {
        const newName = `👥 Members: ${totalMembers.toLocaleString()}`;
        if (ch.name !== newName) {
          await ch.setName(newName).catch(() => {});
        }
      }
    }

    // Update Online Channel
    if (stat_channel_online) {
      const ch = guild.channels.cache.get(stat_channel_online);
      if (ch && ch.type === ChannelType.GuildVoice) {
        const newName = `🟢 Online: ${onlineCount.toLocaleString()}`;
        if (ch.name !== newName) {
          await ch.setName(newName).catch(() => {});
        }
      }
    }

    // Update Bots Channel
    if (stat_channel_bots) {
      const ch = guild.channels.cache.get(stat_channel_bots);
      if (ch && ch.type === ChannelType.GuildVoice) {
        const newName = `🤖 Bots: ${botCount.toLocaleString()}`;
        if (ch.name !== newName) {
          await ch.setName(newName).catch(() => {});
        }
      }
    }

    logger.info(`[VOICE STATS] Successfully updated stat counters for ${guild.name} (Total: ${totalMembers}, Online: ${onlineCount}, Bots: ${botCount})`);
  } catch (err: any) {
    logger.error({ err }, `[VOICE STATS] Failed updating stat counters for ${guild.name}`);
  }
}

/**
 * One-click automatic creation of Server Stats channels and category
 */
export async function setupDefaultStatCounters(guild: Guild): Promise<{
  success: boolean;
  categoryId?: string;
  membersChannelId?: string;
  onlineChannelId?: string;
  botsChannelId?: string;
  error?: string;
}> {
  try {
    const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
    if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return { success: false, error: 'Bot is missing "Manage Channels" permission' };
    }

    // 1. Create Locked Category at the top
    const category = await guild.channels.create({
      name: '📊 SERVER STATS',
      type: ChannelType.GuildCategory,
      position: 0,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // 2. Create Members Voice Channel
    const membersChannel = await guild.channels.create({
      name: `👥 Members: ${guild.memberCount.toLocaleString()}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // 3. Create Online Voice Channel
    const onlineChannel = await guild.channels.create({
      name: `🟢 Online: Calculating...`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // 4. Create Bots Voice Channel
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const botsChannel = await guild.channels.create({
      name: `🤖 Bots: ${botCount.toLocaleString()}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.Connect],
          allow: [PermissionFlagsBits.ViewChannel],
        },
      ],
    });

    // Save to Database
    await db.query(
      `UPDATE guild_settings SET 
        stat_counters_enabled = TRUE,
        stat_category_id = $1,
        stat_channel_members = $2,
        stat_channel_online = $3,
        stat_channel_bots = $4,
        updated_at = CURRENT_TIMESTAMP
       WHERE guild_id = $5`,
      [category.id, membersChannel.id, onlineChannel.id, botsChannel.id, guild.id]
    );

    return {
      success: true,
      categoryId: category.id,
      membersChannelId: membersChannel.id,
      onlineChannelId: onlineChannel.id,
      botsChannelId: botsChannel.id,
    };
  } catch (err: any) {
    logger.error({ err }, `[VOICE STATS] Failed setup for guild ${guild.id}`);
    return { success: false, error: err.message };
  }
}
