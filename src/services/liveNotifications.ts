import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export interface LiveFeedItem {
  id: string;
  guild_id: string;
  type: 'security' | 'ticket' | 'game' | 'milestone' | 'system';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
  created_at: string;
  metadata?: Record<string, any>;
}

// In-memory ring buffer of live notifications per guild (keeps last 50)
const memoryLiveFeeds: Map<string, LiveFeedItem[]> = new Map();
const postedGiveawayIds: Set<number> = new Set();

/**
 * Record a live event in the in-memory feed for instant Web Dashboard visibility
 */
export function recordLiveEvent(item: {
  guild_id: string;
  type: 'security' | 'ticket' | 'game' | 'milestone' | 'system';
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'critical' | 'success';
  metadata?: Record<string, any>;
}): LiveFeedItem {
  const fullItem: LiveFeedItem = {
    id: `live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    guild_id: item.guild_id,
    type: item.type,
    title: item.title,
    description: item.description,
    severity: item.severity || 'info',
    created_at: new Date().toISOString(),
    metadata: item.metadata,
  };

  const list = memoryLiveFeeds.get(item.guild_id) || [];
  list.unshift(fullItem);
  if (list.length > 50) list.pop();
  memoryLiveFeeds.set(item.guild_id, list);

  return fullItem;
}

/**
 * Broadcast an alert to Discord notification channel & push to Dashboard Live Feed
 */
export async function broadcastLiveNotification(
  bot: Client,
  guildId: string,
  alert: {
    type: 'security' | 'ticket' | 'game' | 'milestone' | 'system';
    title: string;
    description: string;
    severity?: 'info' | 'warning' | 'critical' | 'success';
    fields?: { name: string; value: string; inline?: boolean }[];
    url?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    actionLabel?: string;
  }
): Promise<boolean> {
  try {
    // 1. Record to Dashboard live feed
    recordLiveEvent({
      guild_id: guildId,
      type: alert.type,
      title: alert.title,
      description: alert.description,
      severity: alert.severity || 'info',
    });

    // 2. Fetch Guild Settings
    const res = await db.query(
      `SELECT notifications_channel_id, free_games_enabled, notif_security_alerts, notif_ticket_alerts, notif_milestones
       FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );

    if (res.rows.length === 0) return false;
    const settings = res.rows[0];

    const channelId = settings.notifications_channel_id;
    if (!channelId) return false;

    // Check module permission toggles
    if (alert.type === 'security' && settings.notif_security_alerts === false) return false;
    if (alert.type === 'ticket' && settings.notif_ticket_alerts === false) return false;
    if (alert.type === 'game' && settings.free_games_enabled === false) return false;
    if (alert.type === 'milestone' && settings.notif_milestones === false) return false;

    const channel = (await bot.channels.fetch(channelId).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) return false;

    // Color theme based on alert category
    let color: `#${string}` = '#6366F1';
    let icon = '🔔';
    if (alert.type === 'security') {
      color = '#EF4444';
      icon = '🚨';
    } else if (alert.type === 'ticket') {
      color = '#8B5CF6';
      icon = '🎫';
    } else if (alert.type === 'game') {
      color = '#10B981';
      icon = '🎮';
    } else if (alert.type === 'milestone') {
      color = '#F59E0B';
      icon = '🏆';
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${icon} ${alert.title}`)
      .setDescription(alert.description)
      .setFooter({ text: 'SRB NEXUS Live Notification Engine' })
      .setTimestamp();

    if (alert.fields && alert.fields.length > 0) {
      embed.addFields(alert.fields);
    }
    if (alert.thumbnailUrl) {
      embed.setThumbnail(alert.thumbnailUrl);
    }
    if (alert.imageUrl) {
      embed.setImage(alert.imageUrl);
    }

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (alert.url) {
      const button = new ButtonBuilder()
        .setLabel(alert.actionLabel || 'View Details')
        .setStyle(ButtonStyle.Link)
        .setURL(alert.url);
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(button));
    }

    await channel.send({ embeds: [embed], components });
    return true;
  } catch (err) {
    logger.error({ err, guildId, alertType: alert.type }, 'Failed to broadcast live notification');
    return false;
  }
}

/**
 * Send a verified test notification to the configured Discord channel
 */
export async function sendTestLiveNotification(
  bot: Client,
  guildId: string,
  user: { id: string; username: string }
): Promise<{ channelName: string; channelId: string }> {
  const res = await db.query(
    `SELECT notifications_channel_id FROM guild_settings WHERE guild_id = $1`,
    [guildId]
  );

  const channelId = res.rows[0]?.notifications_channel_id;
  if (!channelId) {
    throw new Error('No notification channel configured. Please select a channel in the Live Notifications tab and click Save first.');
  }

  const guild = bot.guilds.cache.get(guildId) || (await bot.guilds.fetch(guildId).catch(() => null));
  if (!guild) {
    throw new Error('Bot is not currently present in this server.');
  }

  const channel = (await guild.channels.fetch(channelId).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) {
    throw new Error(`The configured notification channel (<#${channelId}>) could not be found or bot lacks permissions.`);
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor('#6366F1')
    .setTitle('🔔 NEXUS Live Notification Hub • Connected & Operational')
    .setDescription(
      `✅ **Test Broadcast Verified!**\n\n` +
      `The SRB NEXUS Live Notification System has successfully bound to this channel.\n` +
      `Real-time dispatches from your Web Dashboard, security shields, ticket systems, and loot feeds will appear here automatically.`
    )
    .addFields(
      { name: '🛡️ Security Radar', value: '`Active` (Anti-Raid, Anti-Spam & Mass-Join alerts)', inline: true },
      { name: '🎫 Ticket Hub', value: '`Active` (Ticket creations, claims & transcripts)', inline: true },
      { name: '🎮 Free Games Feed', value: '`Active` (100% OFF Steam & Epic Loot drops)', inline: true },
      { name: '👤 Dispatched By', value: `<@${user.id}> (\`${user.username}\`)`, inline: true },
      { name: '📡 Gateway Status', value: `🟢 Real-Time Connected (<t:${nowSeconds}:R>)`, inline: true },
      { name: '🎯 Target Channel', value: `<#${channel.id}>`, inline: true }
    )
    .setFooter({ text: 'SRB NEXUS Live Notification System • Web Control Panel' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });

  // Record in memory feed
  recordLiveEvent({
    guild_id: guildId,
    type: 'system',
    title: 'Live Notification Test Broadcast',
    description: `Test alert dispatched by ${user.username} to #${channel.name}`,
    severity: 'success',
  });

  return { channelName: channel.name, channelId: channel.id };
}

/**
 * Get unified live feed combining DB incident logs and in-memory live stream
 */
export async function getGuildLiveFeed(guildId: string): Promise<LiveFeedItem[]> {
  const items: LiveFeedItem[] = [];

  // 1. Fetch DB security events
  try {
    const secRes = await db.query(
      `SELECT id, event_type, details, action_taken, created_at 
       FROM security_events 
       WHERE guild_id = $1 
       ORDER BY created_at DESC LIMIT 15`,
      [guildId]
    );

    for (const row of secRes.rows) {
      items.push({
        id: `sec_${row.id}`,
        guild_id: guildId,
        type: 'security',
        title: `Security: ${row.event_type.replace(/_/g, ' ')}`,
        description: row.details || `Action: ${row.action_taken || 'Shield Triggered'}`,
        severity: 'critical',
        created_at: new Date(row.created_at).toISOString(),
      });
    }
  } catch {}

  // 2. Fetch DB moderation logs
  try {
    const modRes = await db.query(
      `SELECT id, action, reason, moderator_id, target_id, created_at 
       FROM moderation_logs 
       WHERE guild_id = $1 
       ORDER BY created_at DESC LIMIT 15`,
      [guildId]
    );

    for (const row of modRes.rows) {
      items.push({
        id: `mod_${row.id}`,
        guild_id: guildId,
        type: 'security',
        title: `Moderation: ${row.action.toUpperCase()}`,
        description: row.reason ? `Reason: ${row.reason}` : `Moderation action taken on user`,
        severity: 'warning',
        created_at: new Date(row.created_at).toISOString(),
      });
    }
  } catch {}

  // 3. Fetch DB tickets
  try {
    const ticketRes = await db.query(
      `SELECT id, ticket_number, status, subject, user_id, created_at 
       FROM guild_tickets 
       WHERE guild_id = $1 
       ORDER BY created_at DESC LIMIT 15`,
      [guildId]
    );

    for (const row of ticketRes.rows) {
      items.push({
        id: `tkt_${row.id}`,
        guild_id: guildId,
        type: 'ticket',
        title: `Support Ticket #${row.ticket_number} (${row.status.toUpperCase()})`,
        description: row.subject || 'Support inquiry dispatched',
        severity: row.status === 'closed' ? 'info' : 'success',
        created_at: new Date(row.created_at).toISOString(),
      });
    }
  } catch {}

  // 4. In-memory events
  const memoryItems = memoryLiveFeeds.get(guildId) || [];
  items.push(...memoryItems);

  // 5. Deduplicate and Sort by timestamp DESC
  const seen = new Set<string>();
  const uniqueItems = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  uniqueItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return uniqueItems.slice(0, 30);
}

/**
 * Periodically check GamerPower for 100% Free PC Games & broadcast to enabled guilds
 */
export async function startFreeGamesWatcher(bot: Client) {
  logger.info('[NOTIF] Initializing GamerPower 100% Free Games watcher...');

  // Run on startup after 15 seconds, then every 20 minutes
  setTimeout(() => checkFreeGames(bot), 15000);
  setInterval(() => checkFreeGames(bot), 20 * 60 * 1000);
}

async function checkFreeGames(bot: Client) {
  try {
    const response = await fetch('https://www.gamerpower.com/api/giveaways?type=game&platform=pc');
    const text = await response.text().catch(() => '');
    if (!response.ok || !text) return;

    let games: any[];
    try {
      games = JSON.parse(text);
    } catch {
      return;
    }
    if (!Array.isArray(games) || games.length === 0) return;

    // Look at top 3 newest active giveaways
    const freshGames = games.slice(0, 3);

    for (const game of freshGames) {
      if (postedGiveawayIds.has(game.id)) continue;
      postedGiveawayIds.add(game.id);

      // Find all guilds with free_games_enabled = true
      const guildRows = await db.query(
        `SELECT guild_id, notifications_channel_id FROM guild_settings 
         WHERE free_games_enabled = TRUE AND notifications_channel_id IS NOT NULL`
      );

      for (const row of guildRows.rows) {
        await broadcastLiveNotification(bot, row.guild_id, {
          type: 'game',
          title: `FREE GAME DROP: ${game.title}`,
          description: `🎁 **${game.title}** is currently **100% FREE** to claim forever!\n\n${game.description || ''}`,
          severity: 'success',
          fields: [
            { name: '💰 Original Worth', value: `~~${game.worth || '$0.00'}~~ **FREE!**`, inline: true },
            { name: '🖥️ Platform', value: game.platforms || 'PC', inline: true },
            { name: '⏳ End Date', value: game.end_date || 'Limited Time', inline: true },
          ],
          url: game.open_giveaway_url || game.gamerpower_url,
          thumbnailUrl: game.thumbnail,
          actionLabel: 'Claim Free Game Now',
        });
      }
    }
  } catch (err) {
    logger.error({ err }, '[NOTIF] Failed to fetch GamerPower giveaways');
  }
}
