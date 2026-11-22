import fs from 'fs';
import path from 'path';
import os from 'os';
import { Client, TextChannel, EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export interface UserBirthday {
  guild_id: string;
  user_id: string;
  birth_day: number;
  birth_month: number;
  birth_year?: number | null;
  last_wished_year?: number;
  created_at?: string;
}

export interface BirthdayGuildConfig {
  guild_id: string;
  channel_id?: string | null;
  role_id?: string | null;
  wish_message?: string;
  wish_time?: string; // 'HH:MM' in IST, default '00:00'
  enabled: boolean;
}

let cachedDataDir: string | null = null;

function getDataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testFile = path.join(localDir, '.write-test');
    fs.writeFileSync(testFile, '');
    fs.unlinkSync(testFile);
    cachedDataDir = localDir;
    return cachedDataDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'srb-nexus-data');
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch {
      // fallback
    }
    cachedDataDir = tmpDir;
    return cachedDataDir;
  }
}

function getBirthdaysFile(): string {
  return path.join(getDataDir(), 'birthdays.json');
}

function getConfigFile(): string {
  return path.join(getDataDir(), 'birthday_config.json');
}

function loadLocalBirthdays(): UserBirthday[] {
  const file = getBirthdaysFile();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function saveLocalBirthdays(list: UserBirthday[]) {
  const file = getBirthdaysFile();
  try {
    fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[BIRTHDAY] Failed to write local birthdays file');
  }
}

function loadLocalConfigs(): Record<string, BirthdayGuildConfig> {
  const file = getConfigFile();
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function saveLocalConfigs(configs: Record<string, BirthdayGuildConfig>) {
  const file = getConfigFile();
  try {
    fs.writeFileSync(file, JSON.stringify(configs, null, 2), 'utf-8');
  } catch (err: any) {
    logger.warn({ err: err?.message }, '[BIRTHDAY] Failed to write local configs file');
  }
}

// Month name helper
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function getMonthName(monthNumber: number): string {
  return MONTH_NAMES[monthNumber - 1] || 'Unknown';
}

/**
 * Get current date & time in Indian Standard Time (IST / UTC+5:30)
 */
export function getISTDate(): { day: number; month: number; year: number; hours: number; minutes: number } {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  return {
    day: ist.getDate(),
    month: ist.getMonth() + 1,
    year: ist.getFullYear(),
    hours: ist.getHours(),
    minutes: ist.getMinutes(),
  };
}

/**
 * Calculate days remaining until next birthday
 */
export function getDaysUntilBirthday(day: number, month: number): number {
  const ist = getISTDate();
  const currentYear = ist.year;

  let nextBday = new Date(currentYear, month - 1, day);
  const today = new Date(currentYear, ist.month - 1, ist.day);

  if (nextBday < today) {
    nextBday = new Date(currentYear + 1, month - 1, day);
  }

  const diffTime = nextBday.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ----------------- DATABASE / FALLBACK OPERATIONS -----------------

export async function getGuildBirthdayConfig(guildId: string): Promise<BirthdayGuildConfig> {
  try {
    if (db.isConnected) {
      const res = await db.query('SELECT * FROM module_birthdays WHERE guild_id = $1', [guildId]);
      if (res.rows.length > 0) return res.rows[0];
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB read failed for config, using fallback');
  }

  const configs = loadLocalConfigs();
  return configs[guildId] || {
    guild_id: guildId,
    channel_id: null,
    role_id: null,
    wish_message: '🎉 Happy Birthday {user}! 🎂 Wishing you an amazing year ahead filled with joy, success, and gaming victories! 🎈✨',
    wish_time: '00:00',
    enabled: true,
  };
}

export async function setGuildBirthdayConfig(config: BirthdayGuildConfig): Promise<void> {
  const configs = loadLocalConfigs();
  configs[config.guild_id] = { ...configs[config.guild_id], ...config };
  saveLocalConfigs(configs);

  try {
    if (db.isConnected) {
      await db.query(`
        INSERT INTO module_birthdays (guild_id, channel_id, role_id, wish_message, wish_time, enabled, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (guild_id) DO UPDATE SET
          channel_id = EXCLUDED.channel_id,
          role_id = EXCLUDED.role_id,
          wish_message = EXCLUDED.wish_message,
          wish_time = EXCLUDED.wish_time,
          enabled = EXCLUDED.enabled,
          updated_at = NOW()
      `, [config.guild_id, config.channel_id, config.role_id, config.wish_message, config.wish_time || '00:00', config.enabled]);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB write failed for config, saved locally');
  }
}

export async function getUserBirthday(guildId: string, userId: string): Promise<UserBirthday | null> {
  try {
    if (db.isConnected) {
      const res = await db.query(
        'SELECT * FROM user_birthdays WHERE guild_id = $1 AND user_id = $2',
        [guildId, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB read failed for user, using local');
  }

  const list = loadLocalBirthdays();
  return list.find((b) => b.guild_id === guildId && b.user_id === userId) || null;
}

export async function setUserBirthday(
  guildId: string,
  userId: string,
  day: number,
  month: number,
  year?: number | null
): Promise<void> {
  const list = loadLocalBirthdays();
  const idx = list.findIndex((b) => b.guild_id === guildId && b.user_id === userId);
  const record: UserBirthday = {
    guild_id: guildId,
    user_id: userId,
    birth_day: day,
    birth_month: month,
    birth_year: year || null,
    last_wished_year: 0,
    created_at: new Date().toISOString(),
  };

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...record };
  } else {
    list.push(record);
  }
  saveLocalBirthdays(list);

  try {
    if (db.isConnected) {
      await db.query(`
        INSERT INTO user_birthdays (guild_id, user_id, birth_day, birth_month, birth_year, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (guild_id, user_id) DO UPDATE SET
          birth_day = EXCLUDED.birth_day,
          birth_month = EXCLUDED.birth_month,
          birth_year = EXCLUDED.birth_year,
          updated_at = NOW()
      `, [guildId, userId, day, month, year || null]);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB write failed for user, saved locally');
  }
}

export async function deleteUserBirthday(guildId: string, userId: string): Promise<boolean> {
  const list = loadLocalBirthdays();
  const filtered = list.filter((b) => !(b.guild_id === guildId && b.user_id === userId));
  const removed = filtered.length < list.length;
  saveLocalBirthdays(filtered);

  try {
    if (db.isConnected) {
      await db.query('DELETE FROM user_birthdays WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB delete failed for user');
  }

  return removed;
}

export async function getGuildUpcomingBirthdays(guildId: string): Promise<Array<UserBirthday & { daysLeft: number }>> {
  let list: UserBirthday[] = [];

  try {
    if (db.isConnected) {
      const res = await db.query('SELECT * FROM user_birthdays WHERE guild_id = $1', [guildId]);
      list = res.rows;
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, '[BIRTHDAY] DB read failed for upcoming, using local');
  }

  if (list.length === 0) {
    list = loadLocalBirthdays().filter((b) => b.guild_id === guildId);
  }

  return list
    .map((b) => ({
      ...b,
      daysLeft: getDaysUntilBirthday(b.birth_day, b.birth_month),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ----------------- AUTOMATED WISH DISPATCHER -----------------

export async function checkAndDispatchBirthdays(bot: Client): Promise<void> {
  const ist = getISTDate();

  for (const [guildId, guild] of bot.guilds.cache) {
    try {
      const config = await getGuildBirthdayConfig(guildId);
      if (!config.enabled) continue;

      // Resolve channel
      let channel: TextChannel | null = null;
      if (config.channel_id) {
        channel = (guild.channels.cache.get(config.channel_id) as TextChannel) || null;
      }

      // If no channel explicitly configured, try to find announcements or general
      if (!channel) {
        channel = (guild.channels.cache.find(
          (c) =>
            c.isTextBased() &&
            (c.name.includes('announcement') ||
              c.name.includes('general') ||
              c.name.includes('public'))
        ) as TextChannel) || null;
      }

      if (!channel || !channel.isTextBased()) continue;

      // Fetch birthdays for today in IST
      let candidates: UserBirthday[] = [];
      try {
        if (db.isConnected) {
          const res = await db.query(`
            SELECT * FROM user_birthdays
            WHERE guild_id = $1 AND birth_day = $2 AND birth_month = $3
              AND (last_wished_year IS NULL OR last_wished_year < $4)
          `, [guildId, ist.day, ist.month, ist.year]);
          candidates = res.rows;
        }
      } catch {
        // Fallback to local
      }

      if (candidates.length === 0) {
        const local = loadLocalBirthdays();
        candidates = local.filter(
          (b) =>
            b.guild_id === guildId &&
            b.birth_day === ist.day &&
            b.birth_month === ist.month &&
            (!b.last_wished_year || b.last_wished_year < ist.year)
        );
      }

      for (const bday of candidates) {
        try {
          const member: GuildMember | null = await guild.members.fetch(bday.user_id).catch(() => null);
          if (!member) continue;

          // Calculate age if year was provided
          const age = bday.birth_year ? ist.year - bday.birth_year : null;
          const ageText = age ? ` celebrating their **${age}th** birthday` : '';

          // Build message
          const rawTemplate =
            config.wish_message ||
            '🎉 Happy Birthday {user}! 🎂 Wishing you an amazing year ahead filled with happiness and victories! 🎈✨';
          const customizedMessage = rawTemplate
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.displayName)
            .replace(/{server}/g, guild.name)
            .replace(/{age}/g, age ? `${age}` : '');

          const wishEmbed = new EmbedBuilder()
            .setColor('#F43F5E') // Vivid Celebration Rose
            .setTitle(`🎂 IT'S CELEBRATION TIME! HAPPY BIRTHDAY! 🎈`)
            .setDescription(
              `Today is a very special day! Everyone join us in wishing <@${member.id}>${ageText}!\n\n` +
              `> ${customizedMessage}\n\n` +
              `🎁 Drop your hearty wishes and love below for <@${member.id}>! 🥳🥂`
            )
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
              { name: '📅 Birthday Date', value: `\`${bday.birth_day} ${getMonthName(bday.birth_month)}\``, inline: true },
              { name: '👑 Birthday VIP', value: `<@${member.id}>`, inline: true }
            )
            .setImage('https://media.giphy.com/media/g5R9dok94mrIvplmZd/giphy.gif')
            .setFooter({ text: `${guild.name} • Birthday Celebrations 🎉`, iconURL: guild.iconURL() || undefined })
            .setTimestamp();

          await channel.send({
            content: `🎉 **HAPPY BIRTHDAY** <@${member.id}>! 🎂🎈`,
            embeds: [wishEmbed],
          });

          logger.info(`[BIRTHDAY] Successfully sent birthday wish for ${member.user.tag} in ${guild.name}`);

          // Assign birthday role if configured
          if (config.role_id) {
            const role = guild.roles.cache.get(config.role_id);
            if (role && !member.roles.cache.has(role.id)) {
              await member.roles.add(role, 'Happy Birthday role assignment!').catch(() => {});
            }
          }

          // Mark as wished for this year
          bday.last_wished_year = ist.year;
          const allLocal = loadLocalBirthdays();
          const target = allLocal.find((x) => x.guild_id === guildId && x.user_id === bday.user_id);
          if (target) {
            target.last_wished_year = ist.year;
            saveLocalBirthdays(allLocal);
          }

          try {
            if (db.isConnected) {
              await db.query(`
                UPDATE user_birthdays
                SET last_wished_year = $1, updated_at = NOW()
                WHERE guild_id = $2 AND user_id = $3
              `, [ist.year, guildId, bday.user_id]);
            }
          } catch {}
        } catch (mErr: any) {
          logger.error({ err: mErr.message }, `[BIRTHDAY] Failed wishing member ${bday.user_id}`);
        }
      }

      // Cleanup expired birthday roles for members whose birthday was yesterday
      if (config.role_id) {
        const bdayRole = guild.roles.cache.get(config.role_id);
        if (bdayRole) {
          for (const [, roleMember] of bdayRole.members) {
            const mBday = await getUserBirthday(guildId, roleMember.id);
            if (!mBday || mBday.birth_day !== ist.day || mBday.birth_month !== ist.month) {
              await roleMember.roles.remove(bdayRole, 'Birthday celebration concluded').catch(() => {});
            }
          }
        }
      }
    } catch (gErr: any) {
      logger.error({ err: gErr.message }, `[BIRTHDAY] Error processing birthdays for guild ${guildId}`);
    }
  }
}
