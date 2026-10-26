import {
  Client,
  Message,
  TextBasedChannel,
  EmbedBuilder,
  PermissionFlagsBits,
  NewsChannel,
  TextChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export interface StickyConfig {
  guild_id: string;
  channel_id: string;
  content: string;
  last_message_id?: string | null;
  embed: boolean;
  embed_title?: string | null;
  embed_color?: string | null;
  is_active: boolean;
  cooldown_seconds: number;
  message_count_threshold: number;
  current_message_count: number;
  last_posted_at: number;
}

// In-memory cache of sticky configurations keyed by channel_id
const stickyCache = new Map<string, StickyConfig>();

// Concurrency mutex lock per channel to prevent duplicate sends during burst traffic
const channelLocks = new Map<string, boolean>();

// Debounce timer per channel when messages arrive faster than cooldown_seconds
const pendingDebounce = new Map<string, NodeJS.Timeout>();

/**
 * Initialize sticky service: load all configured sticky messages from database into cache
 */
export async function initStickyService(client: Client): Promise<void> {
  try {
    const res = await db.query(
      `SELECT guild_id, channel_id, content, last_message_id, embed, embed_title, embed_color,
              is_active, cooldown_seconds, message_count_threshold,
              EXTRACT(EPOCH FROM last_posted_at) * 1000 AS last_posted_ms
       FROM guild_sticky_messages`
    );

    stickyCache.clear();
    for (const row of res.rows) {
      stickyCache.set(row.channel_id, {
        guild_id: row.guild_id,
        channel_id: row.channel_id,
        content: row.content,
        last_message_id: row.last_message_id || null,
        embed: Boolean(row.embed),
        embed_title: row.embed_title || null,
        embed_color: row.embed_color || '#5865F2',
        is_active: Boolean(row.is_active),
        cooldown_seconds: Number(row.cooldown_seconds ?? 3),
        message_count_threshold: Number(row.message_count_threshold ?? 1),
        current_message_count: 0,
        last_posted_at: Number(row.last_posted_ms ?? 0),
      });
    }

    logger.info({ count: stickyCache.size }, '[STICKY] Initialized sticky message service and loaded active configs');
  } catch (err) {
    logger.error({ err }, '[STICKY] Failed to initialize sticky messages from database');
  }
}

/**
 * Format sticky message payload matching the Discord Sticky Bot layout
 */
export function buildStickyPayload(config: StickyConfig): {
  content: string;
  embeds?: EmbedBuilder[];
} {
  const header = '__Stickied Message:__';

  if (config.embed) {
    const embed = new EmbedBuilder()
      .setTitle(config.embed_title || '📌 Stickied Message')
      .setDescription(config.content)
      .setColor((config.embed_color as any) || 0x5865f2)
      .setFooter({ text: 'Stickied Message • SRB NEXUS' })
      .setTimestamp();

    return {
      content: header,
      embeds: [embed],
    };
  }

  return {
    content: `${header}\n\n${config.content}`,
  };
}

/**
 * Repost a sticky message to the bottom of the channel
 */
export async function repostSticky(channel: TextBasedChannel, config: StickyConfig): Promise<boolean> {
  if (channelLocks.get(config.channel_id)) {
    return false;
  }

  channelLocks.set(config.channel_id, true);

  try {
    // If the channel's very last message is already the sticky message, do not duplicate
    if ('lastMessageId' in channel && channel.lastMessageId === config.last_message_id) {
      return false;
    }

    // 1. Delete previous sticky message if present
    if (config.last_message_id && 'messages' in channel) {
      try {
        const oldMsg = await channel.messages.fetch(config.last_message_id).catch(() => null);
        if (oldMsg && oldMsg.deletable) {
          await oldMsg.delete().catch(() => {});
        }
      } catch {
        // Ignore deletion errors if message was already removed
      }
    }

    // 2. Send the new sticky message
    const payload = buildStickyPayload(config);
    const newMsg = await (channel as any).send(payload);

    // 3. Update in-memory cache
    config.last_message_id = newMsg.id;
    config.last_posted_at = Date.now();
    config.current_message_count = 0;

    // 4. Update database record asynchronously
    db.query(
      `UPDATE guild_sticky_messages
       SET last_message_id = $1, last_posted_at = NOW(), current_message_count = 0
       WHERE channel_id = $2`,
      [newMsg.id, config.channel_id]
    ).catch((err) => logger.error({ err, channelId: config.channel_id }, '[STICKY] Failed to persist last_message_id'));

    return true;
  } catch (err) {
    logger.error({ err, channelId: config.channel_id }, '[STICKY] Failed to repost sticky message');
    return false;
  } finally {
    channelLocks.delete(config.channel_id);
  }
}

/**
 * Handle incoming message to determine if sticky message needs to be repositioned
 */
export async function handleStickyOnMessage(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const channelId = message.channel.id;
  const config = stickyCache.get(channelId);

  if (!config || !config.is_active) return;

  // Never trigger if the incoming message is the sticky message itself
  if (message.id === config.last_message_id) return;

  config.current_message_count++;

  // Check if threshold count is reached
  if (config.current_message_count < config.message_count_threshold) {
    return;
  }

  const now = Date.now();
  const elapsed = now - config.last_posted_at;
  const cooldownMs = Math.max(config.cooldown_seconds, 1) * 1000;

  if (elapsed < cooldownMs) {
    // If cooldown has not elapsed, debounce the repost so it fires right when cooldown ends
    if (!pendingDebounce.has(channelId)) {
      const remainingMs = cooldownMs - elapsed;
      const timeout = setTimeout(() => {
        pendingDebounce.delete(channelId);
        repostSticky(message.channel, config).catch(() => {});
      }, Math.max(remainingMs, 500));
      pendingDebounce.set(channelId, timeout);
    }
    return;
  }

  // Clear any existing debounce timer
  if (pendingDebounce.has(channelId)) {
    clearTimeout(pendingDebounce.get(channelId)!);
    pendingDebounce.delete(channelId);
  }

  await repostSticky(message.channel, config);
}

/**
 * Set or update a sticky message for a channel
 */
export async function setStickyMessage(options: {
  guildId: string;
  channelId: string;
  content: string;
  embed?: boolean;
  embedTitle?: string | null;
  embedColor?: string | null;
  cooldownSeconds?: number;
  messageCountThreshold?: number;
  channel: TextBasedChannel;
}): Promise<{ success: boolean; message: string; stickyConfig?: StickyConfig }> {
  const {
    guildId,
    channelId,
    content,
    embed = false,
    embedTitle = null,
    embedColor = '#5865F2',
    cooldownSeconds = 3,
    messageCountThreshold = 1,
    channel,
  } = options;

  try {
    // Existing config check
    const existing = stickyCache.get(channelId);

    // If an existing message is in channel, delete it first
    if (existing?.last_message_id && 'messages' in channel) {
      try {
        const oldMsg = await channel.messages.fetch(existing.last_message_id).catch(() => null);
        if (oldMsg && oldMsg.deletable) {
          await oldMsg.delete().catch(() => {});
        }
      } catch {
        // ignore
      }
    }

    const config: StickyConfig = {
      guild_id: guildId,
      channel_id: channelId,
      content,
      last_message_id: null,
      embed,
      embed_title: embedTitle,
      embed_color: embedColor,
      is_active: true,
      cooldown_seconds: Math.max(cooldownSeconds, 1),
      message_count_threshold: Math.max(messageCountThreshold, 1),
      current_message_count: 0,
      last_posted_at: 0,
    };

    // Send initial sticky message
    const payload = buildStickyPayload(config);
    const sent = await (channel as any).send(payload);

    config.last_message_id = sent.id;
    config.last_posted_at = Date.now();

    // Persist into database
    await db.query(
      `INSERT INTO guild_sticky_messages (
        guild_id, channel_id, content, last_message_id, embed, embed_title, embed_color,
        is_active, cooldown_seconds, message_count_threshold, current_message_count, last_posted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (channel_id) DO UPDATE SET
        guild_id = EXCLUDED.guild_id,
        content = EXCLUDED.content,
        last_message_id = EXCLUDED.last_message_id,
        embed = EXCLUDED.embed,
        embed_title = EXCLUDED.embed_title,
        embed_color = EXCLUDED.embed_color,
        is_active = EXCLUDED.is_active,
        cooldown_seconds = EXCLUDED.cooldown_seconds,
        message_count_threshold = EXCLUDED.message_count_threshold,
        current_message_count = 0,
        last_posted_at = NOW(),
        updated_at = NOW()`,
      [
        guildId,
        channelId,
        content,
        sent.id,
        embed,
        embedTitle,
        embedColor,
        true,
        config.cooldown_seconds,
        config.message_count_threshold,
        0,
      ]
    );

    // Update in-memory cache
    stickyCache.set(channelId, config);

    return {
      success: true,
      message: `✅ Sticky message successfully pinned to <#${channelId}>!`,
      stickyConfig: config,
    };
  } catch (err: any) {
    logger.error({ err, channelId }, '[STICKY] Failed to set sticky message');
    return {
      success: false,
      message: `❌ Failed to set sticky message: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Remove a sticky message from a channel
 */
export async function removeStickyMessage(
  channelId: string,
  guildId: string,
  channel?: TextBasedChannel | null
): Promise<{ success: boolean; message: string }> {
  try {
    const config = stickyCache.get(channelId);

    // Cancel any pending debounce
    if (pendingDebounce.has(channelId)) {
      clearTimeout(pendingDebounce.get(channelId)!);
      pendingDebounce.delete(channelId);
    }

    // Delete message from Discord if possible
    if (config?.last_message_id && channel && 'messages' in channel) {
      try {
        const oldMsg = await channel.messages.fetch(config.last_message_id).catch(() => null);
        if (oldMsg && oldMsg.deletable) {
          await oldMsg.delete().catch(() => {});
        }
      } catch {
        // ignore
      }
    }

    await db.query(`DELETE FROM guild_sticky_messages WHERE channel_id = $1 AND guild_id = $2`, [channelId, guildId]);
    stickyCache.delete(channelId);

    return {
      success: true,
      message: `🗑️ Sticky message removed from <#${channelId}>.`,
    };
  } catch (err: any) {
    logger.error({ err, channelId }, '[STICKY] Failed to remove sticky message');
    return {
      success: false,
      message: `❌ Failed to remove sticky message: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * Pause or resume sticky message in a channel
 */
export async function toggleStickyMessage(
  channelId: string,
  guildId: string,
  activate: boolean,
  channel?: TextBasedChannel | null
): Promise<{ success: boolean; message: string }> {
  try {
    let config = stickyCache.get(channelId);
    if (!config) {
      const res = await db.query(
        `SELECT guild_id, channel_id, content, last_message_id, embed, embed_title, embed_color,
                is_active, cooldown_seconds, message_count_threshold,
                EXTRACT(EPOCH FROM last_posted_at) * 1000 AS last_posted_ms
         FROM guild_sticky_messages
         WHERE channel_id = $1 AND guild_id = $2`,
        [channelId, guildId]
      );
      if (res.rows.length === 0) {
        return {
          success: false,
          message: `❌ No sticky message found in <#${channelId}>.`,
        };
      }
      const row = res.rows[0];
      config = {
        guild_id: row.guild_id,
        channel_id: row.channel_id,
        content: row.content,
        last_message_id: row.last_message_id || null,
        embed: Boolean(row.embed),
        embed_title: row.embed_title || null,
        embed_color: row.embed_color || '#5865F2',
        is_active: Boolean(row.is_active),
        cooldown_seconds: Number(row.cooldown_seconds ?? 3),
        message_count_threshold: Number(row.message_count_threshold ?? 1),
        current_message_count: 0,
        last_posted_at: Number(row.last_posted_ms ?? 0),
      };
      stickyCache.set(channelId, config);
    }

    config.is_active = activate;
    await db.query(
      `UPDATE guild_sticky_messages SET is_active = $1, updated_at = NOW() WHERE channel_id = $2 AND guild_id = $3`,
      [activate, channelId, guildId]
    );

    if (activate && channel) {
      await repostSticky(channel, config);
    }

    return {
      success: true,
      message: activate
        ? `▶️ Sticky message resumed in <#${channelId}>.`
        : `⏸️ Sticky message paused in <#${channelId}>.`,
    };
  } catch (err: any) {
    logger.error({ err, channelId }, '[STICKY] Failed to toggle sticky message');
    return {
      success: false,
      message: `❌ Failed to toggle sticky status: ${err?.message || 'Unknown error'}`,
    };
  }
}

/**
 * List all sticky messages configured in a guild
 */
export async function listGuildStickyMessages(guildId: string): Promise<StickyConfig[]> {
  try {
    const res = await db.query(
      `SELECT guild_id, channel_id, content, last_message_id, embed, embed_title, embed_color,
              is_active, cooldown_seconds, message_count_threshold,
              EXTRACT(EPOCH FROM last_posted_at) * 1000 AS last_posted_ms
       FROM guild_sticky_messages
       WHERE guild_id = $1
       ORDER BY created_at ASC`,
      [guildId]
    );

    return res.rows.map((row: any) => ({
      guild_id: row.guild_id,
      channel_id: row.channel_id,
      content: row.content,
      last_message_id: row.last_message_id || null,
      embed: Boolean(row.embed),
      embed_title: row.embed_title || null,
      embed_color: row.embed_color || '#5865F2',
      is_active: Boolean(row.is_active),
      cooldown_seconds: Number(row.cooldown_seconds ?? 3),
      message_count_threshold: Number(row.message_count_threshold ?? 1),
      current_message_count: 0,
      last_posted_at: Number(row.last_posted_ms ?? 0),
    }));
  } catch (err) {
    logger.error({ err, guildId }, '[STICKY] Failed to list sticky messages');
    return [];
  }
}

/**
 * Get sticky configuration for a specific channel
 */
export function getStickyConfig(channelId: string): StickyConfig | undefined {
  return stickyCache.get(channelId);
}
