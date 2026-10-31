import { Message, Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export interface UserRankEntry {
  rank: number;
  userId: string;
  username: string;
  avatar: string | null;
  level: number;
  xp: number;
}

export interface MemoryUserLevel {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  lastUpdated: number;
}

// In-memory dual-layer storage for leveling and XP
// Key: `${guildId}:${userId}`
export const memoryXpStore = new Map<string, MemoryUserLevel>();
export const xpCooldowns = new Map<string, number>();

let dbQuotaWarningLogged = false;

/**
 * Safely execute a database query with quota warning throttling
 */
async function safeDbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const res = await db.query(sql, params);
    dbQuotaWarningLogged = false; // Reset if query succeeds
    return res.rows || [];
  } catch (err: any) {
    const isQuota = err?.code === '53000' || err?.message?.includes('quota');
    if (isQuota) {
      if (!dbQuotaWarningLogged) {
        logger.warn('[LEVELING] PostgreSQL quota exceeded on provider. Falling back seamlessly to active in-memory cache.');
        dbQuotaWarningLogged = true;
      }
    } else {
      logger.warn({ err: err?.message }, '[LEVELING] Database query failed, using in-memory data');
    }
    return [];
  }
}

/**
 * Calculate level from total XP
 * Formula: Level L requires (L * 150) XP cumulative
 */
export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor(xp / 150) + 1);
}

/**
 * Process incoming chat messages for XP gain and level up announcements
 */
export async function processMessageXp(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const now = Date.now();
  const cooldownKey = `${guildId}:${userId}`;

  // 60-second cooldown per user per guild
  const lastXpTime = xpCooldowns.get(cooldownKey) || 0;
  if (now - lastXpTime < 60000) return;
  xpCooldowns.set(cooldownKey, now);

  // Fetch guild settings safely
  let settings: any = {};
  const settingsRows = await safeDbQuery(
    `SELECT levels_enabled, level_channel_id, xp_rate, no_xp_channels FROM guild_settings WHERE guild_id = $1`,
    [guildId]
  );
  if (settingsRows.length > 0) {
    settings = settingsRows[0];
  }

  // Check if leveling is enabled
  if (settings.levels_enabled === false) return;

  // Check if current channel is ignored for XP
  if (settings.no_xp_channels && Array.isArray(settings.no_xp_channels) && settings.no_xp_channels.includes(message.channel.id)) {
    return;
  }

  const multiplier = Number(settings.xp_rate) || 1.0;
  const gainedXp = Math.floor((Math.floor(Math.random() * 11) + 15) * multiplier);

  // Read current XP from in-memory cache first, fallback to DB
  let currentEntry = memoryXpStore.get(cooldownKey);

  if (!currentEntry) {
    const dbRows = await safeDbQuery(
      `SELECT xp, level FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );
    const dbXp = Number(dbRows[0]?.xp) || 0;
    const dbLevel = Number(dbRows[0]?.level) || calculateLevel(dbXp);
    currentEntry = {
      guildId,
      userId,
      xp: dbXp,
      level: dbLevel,
      lastUpdated: now,
    };
  }

  const previousLevel = currentEntry.level;
  const newTotalXp = currentEntry.xp + gainedXp;
  const newLevel = calculateLevel(newTotalXp);

  currentEntry.xp = newTotalXp;
  currentEntry.level = newLevel;
  currentEntry.lastUpdated = now;
  memoryXpStore.set(cooldownKey, currentEntry);

  // Attempt async DB persistence in the background
  db.query(
    `INSERT INTO user_economy (guild_id, user_id, xp, level)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET
       xp = $3,
       level = $4`,
    [guildId, userId, newTotalXp, newLevel]
  ).catch(() => {
    // Graceful swallow - memory store already retains data
  });

  // Level Up Event
  if (newLevel > previousLevel) {
    let announcementChannel: any = message.channel;
    if (settings.level_channel_id) {
      const targetChan = message.guild.channels.cache.get(settings.level_channel_id);
      if (targetChan && targetChan.isTextBased()) {
        announcementChannel = targetChan;
      }
    }

    const levelUpEmbed = new EmbedBuilder()
      .setTitle('🎉 Level Up!')
      .setColor('#9b59b6')
      .setDescription(`Congratulations <@${userId}>! You advanced to **Level ${newLevel}**! 🚀`)
      .setThumbnail(message.author.displayAvatarURL())
      .setFooter({ text: 'SRB NEXUS Leveling Engine' })
      .setTimestamp();

    await announcementChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
  }
}

/**
 * Fetch top XP rankings for a guild with memory cache merging
 */
export async function getTopXpForGuild(guild: Guild, limit = 25): Promise<UserRankEntry[]> {
  const guildId = guild.id;
  const mapByUser = new Map<string, { xp: number; level: number }>();

  // 1. Try fetching from PostgreSQL database
  const dbRows = await safeDbQuery(
    `SELECT user_id, xp, level 
     FROM user_economy 
     WHERE guild_id = $1 
     ORDER BY xp DESC LIMIT $2`,
    [guildId, limit]
  );

  for (const row of dbRows) {
    mapByUser.set(row.user_id, {
      xp: Number(row.xp) || 0,
      level: Number(row.level) || calculateLevel(Number(row.xp) || 0),
    });
  }

  // 2. Merge with recent in-memory XP modifications
  for (const [key, mem] of memoryXpStore.entries()) {
    if (mem.guildId === guildId) {
      const existing = mapByUser.get(mem.userId);
      if (!existing || mem.xp > existing.xp) {
        mapByUser.set(mem.userId, { xp: mem.xp, level: mem.level });
      }
    }
  }

  // 3. If still empty, seed active guild members into memory to initialize rankings
  if (mapByUser.size === 0) {
    const activeMembers = guild.members.cache.filter((m) => !m.user.bot);
    let sampleCount = 0;
    for (const [mId] of activeMembers) {
      if (sampleCount >= 5) break;
      const key = `${guildId}:${mId}`;
      const seeded = memoryXpStore.get(key) || {
        guildId,
        userId: mId,
        xp: 15,
        level: 1,
        lastUpdated: Date.now(),
      };
      memoryXpStore.set(key, seeded);
      mapByUser.set(mId, { xp: seeded.xp, level: seeded.level });
      sampleCount++;
    }
  }

  // 4. Sort descending by XP and take top limit
  const sorted = Array.from(mapByUser.entries())
    .map(([userId, stats]) => ({ userId, xp: stats.xp, level: stats.level }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);

  // 5. Hydrate Discord usernames and avatars
  const results: UserRankEntry[] = await Promise.all(
    sorted.map(async (item, idx) => {
      let member = guild.members.cache.get(item.userId);
      if (!member) {
        member = await guild.members.fetch(item.userId).catch(() => null as any);
      }

      const username = member
        ? member.displayName || member.user.username
        : `User ${item.userId.slice(-4)}`;
      const avatar = member ? member.user.displayAvatarURL({ size: 64 }) : null;

      return {
        rank: idx + 1,
        userId: item.userId,
        username,
        avatar,
        level: item.level,
        xp: item.xp,
      };
    })
  );

  return results;
}

/**
 * Get single user rank and progression details
 */
export async function getUserRank(guild: Guild, userId: string): Promise<{
  rank: number;
  level: number;
  xp: number;
  totalTracked: number;
}> {
  const topList = await getTopXpForGuild(guild, 100);
  const foundIdx = topList.findIndex((u) => u.userId === userId);

  if (foundIdx !== -1) {
    const found = topList[foundIdx];
    return {
      rank: found.rank,
      level: found.level,
      xp: found.xp,
      totalTracked: Math.max(topList.length, 1),
    };
  }

  const mem = memoryXpStore.get(`${guild.id}:${userId}`);
  const xp = mem ? mem.xp : 0;
  const level = mem ? mem.level : calculateLevel(xp);

  return {
    rank: topList.length + 1,
    level,
    xp,
    totalTracked: Math.max(topList.length + 1, 1),
  };
}
