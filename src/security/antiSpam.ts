import { Message, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../core/database';
import { logSecurityEvent } from './logger';
import { logger } from '../core/logger';

interface MessageCache {
  timestamps: number[];
  contents: string[];
  violationCount: number;
  lastViolationTime: number;
}

export interface SpamCatcherConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high' | 'extreme';
  action: 'DELETE' | 'TIMEOUT' | 'KICK' | 'BAN';
  timeout_duration_seconds: number;
  max_messages_per_window: number;
  window_seconds: number;
  max_duplicates: number;
  max_mentions: number;
  anti_discord_invites: boolean;
  anti_phishing_links: boolean;
  honeypot_channel_id: string | null;
  log_channel_id: string | null;
  whitelist_roles: string[];
  whitelist_channels: string[];
  owner_dm_alert: boolean;
}

const userTracker = new Map<string, MessageCache>();
const configCache = new Map<string, { config: SpamCatcherConfig; cachedAt: number }>();

// Cleanup stale user records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, tracking] of userTracker.entries()) {
    if (tracking.timestamps.length === 0 || now - tracking.timestamps[tracking.timestamps.length - 1] > 60000) {
      userTracker.delete(userId);
    }
  }
}, 10 * 60 * 1000);

export function invalidateSpamCatcherCache(guildId: string) {
  configCache.delete(guildId);
}

export async function getSpamCatcherConfig(guildId: string): Promise<SpamCatcherConfig> {
  const cached = configCache.get(guildId);
  const now = Date.now();
  if (cached && now - cached.cachedAt < 15000) {
    return cached.config;
  }

  const res = await db.query(
    `SELECT * FROM guild_spam_catcher WHERE guild_id = $1`,
    [guildId]
  ).catch(() => ({ rows: [] }));

  let row = res.rows[0];
  if (!row) {
    row = {
      enabled: true,
      sensitivity: 'medium',
      action: 'TIMEOUT',
      timeout_duration_seconds: 300,
      max_messages_per_window: 5,
      window_seconds: 4,
      max_duplicates: 3,
      max_mentions: 4,
      anti_discord_invites: true,
      anti_phishing_links: true,
      honeypot_channel_id: null,
      log_channel_id: null,
      whitelist_roles: [],
      whitelist_channels: [],
      owner_dm_alert: false,
    };
  }

  const sensitivity = (row.sensitivity || 'medium').toLowerCase() as 'low' | 'medium' | 'high' | 'extreme';
  let windowSeconds = row.window_seconds || 4;
  let maxMessages = row.max_messages_per_window || 5;
  let maxDuplicates = row.max_duplicates || 3;
  let maxMentions = row.max_mentions || 4;

  if (sensitivity === 'low') {
    windowSeconds = 6;
    maxMessages = 8;
    maxDuplicates = 4;
    maxMentions = 6;
  } else if (sensitivity === 'high') {
    windowSeconds = 3;
    maxMessages = 4;
    maxDuplicates = 2;
    maxMentions = 3;
  } else if (sensitivity === 'extreme') {
    windowSeconds = 2;
    maxMessages = 3;
    maxDuplicates = 2;
    maxMentions = 2;
  }

  const config: SpamCatcherConfig = {
    enabled: row.enabled !== false,
    sensitivity,
    action: (row.action || 'TIMEOUT').toUpperCase() as any,
    timeout_duration_seconds: row.timeout_duration_seconds || 300,
    max_messages_per_window: maxMessages,
    window_seconds: windowSeconds,
    max_duplicates: maxDuplicates,
    max_mentions: maxMentions,
    anti_discord_invites: row.anti_discord_invites !== false,
    anti_phishing_links: row.anti_phishing_links !== false,
    honeypot_channel_id: row.honeypot_channel_id || null,
    log_channel_id: row.log_channel_id || null,
    whitelist_roles: Array.isArray(row.whitelist_roles) ? row.whitelist_roles : [],
    whitelist_channels: Array.isArray(row.whitelist_channels) ? row.whitelist_channels : [],
    owner_dm_alert: row.owner_dm_alert === true,
  };

  configCache.set(guildId, { config, cachedAt: now });
  return config;
}

/**
 * SRB NEXUS Sovereign Spam Catcher Engine
 * Detects velocity flooding, repeat text spam, invite spam, honeypot traps, and mass mentions.
 * Fully configurable by Server Owner via Discord commands (/spamcatcher) and Web Dashboard.
 */
export async function processAntiSpam(message: Message): Promise<boolean> {
  if (!message.guild || !message.member || message.author.bot) return false;

  const guild = message.guild;
  const cfg = await getSpamCatcherConfig(guild.id);
  if (!cfg.enabled) return false;

  const member = message.member;
  const userId = message.author.id;
  const now = Date.now();

  // 1. Sovereign Bypass Checks: Server Owner & Bot Developer are always immune
  if (userId === guild.ownerId) return false;

  // Whitelisted Channels
  if (cfg.whitelist_channels.includes(message.channel.id)) return false;

  // Whitelisted Roles or Server Admins
  if (member.permissions.has('Administrator')) return false;
  if (member.roles.cache.some((r) => cfg.whitelist_roles.includes(r.id))) return false;

  // ==========================================================
  // A. HONEYPOT TRAP CHANNEL ENFORCEMENT
  // ==========================================================
  if (cfg.honeypot_channel_id && message.channel.id === cfg.honeypot_channel_id) {
    if (message.deletable) await message.delete().catch(() => {});

    const reason = '🍯 Honeypot Trap Triggered: Posted in restricted decoy spam trap channel';
    await enforceSpamCatcherAction(message, cfg, reason, 'HONEYPOT_TRIGGER');
    return true;
  }

  // ==========================================================
  // B. DISCORD INVITE LINK SPAM
  // ==========================================================
  if (cfg.anti_discord_invites) {
    const inviteRegex = /(discord\.(gg|io|me|li)\/.+|discordapp\.com\/invite\/.+|discord\.com\/invite\/.+)/i;
    if (inviteRegex.test(message.content)) {
      if (message.deletable) await message.delete().catch(() => {});

      const reason = 'Unauthorized Discord Invite Link Spam';
      await enforceSpamCatcherAction(message, cfg, reason, 'INVITE_SPAM');
      return true;
    }
  }

  // ==========================================================
  // C. VELOCITY FLOODING, DUPLICATES & MASS MENTIONS
  // ==========================================================
  const windowMs = cfg.window_seconds * 1000;
  const maxMessages = cfg.max_messages_per_window;
  const maxDuplicates = cfg.max_duplicates;
  const maxMentions = cfg.max_mentions;

  let tracking = userTracker.get(userId);
  if (!tracking) {
    tracking = { timestamps: [], contents: [], violationCount: 0, lastViolationTime: 0 };
    userTracker.set(userId, tracking);
  }

  // Clean old timestamps outside sliding window
  tracking.timestamps = tracking.timestamps.filter((t) => now - t < windowMs);
  tracking.timestamps.push(now);
  tracking.contents.push(message.content);

  if (tracking.contents.length > tracking.timestamps.length) {
    tracking.contents = tracking.contents.slice(-tracking.timestamps.length);
  }

  // 1. Mass Mentions
  const totalMentions = message.mentions.users.size + message.mentions.roles.size;
  const isMassMention = totalMentions > maxMentions;

  // 2. Frequency Flooding
  const isFrequencySpam = tracking.timestamps.length >= maxMessages;

  // 3. Repeated Duplicate Messages
  const isDuplicateSpam =
    tracking.contents.length >= maxDuplicates &&
    tracking.contents.slice(-maxDuplicates).every((c) => c.length > 4 && c === message.content);

  if (isFrequencySpam || isDuplicateSpam || isMassMention) {
    let reason = 'Message Velocity Flooding';
    if (isMassMention) reason = `Mass Mention Spam (${totalMentions} mentions, limit: ${maxMentions})`;
    else if (isDuplicateSpam) reason = `Duplicate Repeated Messages (${maxDuplicates} identical msgs)`;

    if (message.deletable) await message.delete().catch(() => {});

    tracking.violationCount++;
    tracking.lastViolationTime = now;

    await enforceSpamCatcherAction(message, cfg, reason, isMassMention ? 'MASS_MENTION' : 'FLOOD_SPAM');
    return true;
  }

  return false;
}

/**
 * Execute Configured Countermeasure Action and Dispatch Security Logs + Owner DM Alert
 */
async function enforceSpamCatcherAction(
  message: Message,
  cfg: SpamCatcherConfig,
  reason: string,
  subType: string
): Promise<void> {
  const guild = message.guild!;
  const member = message.member!;
  const userId = message.author.id;
  const action = cfg.action;

  try {
    let actionLabel = 'DELETED';

    if (action === 'BAN' && member.bannable) {
      await member.ban({ reason: `[SRB NEXUS SPAM CATCHER] ${reason}` }).catch(() => {});
      actionLabel = 'BAN';
    } else if (action === 'KICK' && member.kickable) {
      await member.kick(`[SRB NEXUS SPAM CATCHER] ${reason}`).catch(() => {});
      actionLabel = 'DIRECT_KICK';
    } else if (action === 'TIMEOUT' && member.moderatable) {
      const timeoutMs = (cfg.timeout_duration_seconds || 300) * 1000;
      await member.timeout(timeoutMs, `[SRB NEXUS SPAM CATCHER] ${reason}`).catch(() => {});
      actionLabel = `TIMEOUT (${Math.round(timeoutMs / 60000)}m)`;
    }

    // Ephemeral in-channel notification
    if ('send' in message.channel && typeof message.channel.send === 'function') {
      const notice = await message.channel.send({
        content: `🛡️ **[SRB NEXUS SPAM CATCHER]** Offending message from <@${userId}> deleted. **Action**: \`${actionLabel}\` • **Reason**: ${reason}`,
      }).catch(() => null);
      if (notice) setTimeout(() => notice.delete().catch(() => {}), 6000);
    }

    // Record total stats in DB
    await db.query(
      `INSERT INTO guild_spam_catcher (guild_id, total_spams_caught)
       VALUES ($1, 1)
       ON CONFLICT (guild_id) DO UPDATE SET total_spams_caught = COALESCE(guild_spam_catcher.total_spams_caught, 0) + 1`,
      [guild.id]
    ).catch(() => {});

    // Log to security_events
    await logSecurityEvent({
      guild,
      userId,
      userTag: message.author.tag,
      action: actionLabel.includes('TIMEOUT') ? 'TIMEOUT' : actionLabel.includes('KICK') ? 'DIRECT_KICK' : actionLabel.includes('BAN') ? 'BAN' : 'TIMEOUT',
      eventType: 'SPAM',
      reason,
      details: `${subType} enforced with ${actionLabel} in #${('name' in message.channel ? message.channel.name : message.channel.id)}`,
    });

    // Custom Log Channel Notification
    const logChannelId = cfg.log_channel_id;
    if (logChannelId) {
      const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (logChannel && logChannel instanceof TextChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('🛡️ [SPAM CATCHER ACTION] Offense Intercepted')
          .setColor(0xff3366)
          .addFields(
            { name: 'Target Offender', value: `<@${userId}> (\`${message.author.tag}\`)`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Action Enforced', value: `\`${actionLabel}\``, inline: true },
            { name: 'Trigger Reason', value: reason, inline: false },
            { name: 'Original Snippet', value: `\`\`\`${message.content.slice(0, 500) || '[No Text]'}\`\`\``, inline: false }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
      }
    }

    // Direct DM Alert to Server Owner (Strictly only if explicitly enabled)
    if (cfg.owner_dm_alert === true) {
      const ownerConfig = await db.query(
        "SELECT owner_dm_alerts FROM guild_owner_config WHERE guild_id = $1",
        [guild.id]
      ).catch(() => ({ rows: [] }));

      // If server owner globally disabled DM alerts, respect it!
      if (ownerConfig.rows.length > 0 && ownerConfig.rows[0].owner_dm_alerts === false) {
        return;
      }

      const owner = await guild.fetchOwner().catch(() => null);
      if (owner && owner.id !== userId) {
        const ownerEmbed = new EmbedBuilder()
          .setTitle(`🛡️ [SPAM CATCHER] Incident in ${guild.name}`)
          .setDescription(`SRB NEXUS intercepted spam in your server **${guild.name}**.`)
          .setColor(0xff3366)
          .addFields(
            { name: 'User', value: `<@${userId}> (\`${message.author.tag}\`)`, inline: true },
            { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: 'Action Taken', value: `\`${actionLabel}\``, inline: true },
            { name: 'Trigger Reason', value: reason, inline: false }
          )
          .setFooter({ text: 'SRB NEXUS Sovereign Server Owner Alert' })
          .setTimestamp();

        await owner.send({ embeds: [ownerEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err, userId }, 'Error enforcing spam catcher action');
  }
}
