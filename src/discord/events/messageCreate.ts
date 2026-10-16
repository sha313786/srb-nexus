import { Message, TextChannel, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';
import { isExempt } from '../../security/whitelist';
import { processAntiSpam } from '../../security/antiSpam';
import { processAntiScam } from '../../security/antiScam';
import { logger } from '../../core/logger';
import { handleModmailDM } from '../../services/modmail';
import { getGuildTag, formatTagMessage } from '../../services/tagEngine';

// In-memory XP cooldown tracker (1 minute per user)
const xpCooldowns = new Map<string, number>();

export async function handleMessageCreate(message: Message): Promise<void> {
  // 0. Modmail inbound DM pipeline
  if (message.channel.isDMBased() && !message.author.bot) {
    await handleModmailDM(message.client, message);
    return;
  }

  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // 0.5. Custom Tag & Auto-Responder Quick Trigger (e.g. !tagname)
  if (message.content.startsWith('!') && message.content.length > 1) {
    const tagName = message.content.slice(1).trim().split(/\s+/)[0].toLowerCase();
    const tag = await getGuildTag(guildId, tagName);
    if (tag) {
      const formatted = formatTagMessage(tag);
      await message.reply(formatted).catch(() => {});
      return;
    }
  }

  // 1. AFK Status Checks
  try {
    // 1a. If author was AFK, remove their AFK status
    const authorAfkRes = await db.query(
      `DELETE FROM user_afk WHERE guild_id = $1 AND user_id = $2 RETURNING reason`,
      [guildId, userId]
    );
    if (authorAfkRes.rows.length > 0) {
      const welcomeMsg = await message.reply({
        content: `👋 Welcome back <@${userId}>! I have removed your AFK status.`,
      }).catch(() => null);
      if (welcomeMsg) {
        setTimeout(() => welcomeMsg.delete().catch(() => {}), 6000);
      }
    }

    // 1b. If message mentions AFK users, inform the author
    if (message.mentions.users.size > 0) {
      for (const [mentionedId, mentionedUser] of message.mentions.users) {
        if (mentionedId === userId || mentionedUser.bot) continue;
        const afkRes = await db.query(
          `SELECT reason, afk_since FROM user_afk WHERE guild_id = $1 AND user_id = $2`,
          [guildId, mentionedId]
        );
        if (afkRes.rows.length > 0) {
          const { reason, afk_since } = afkRes.rows[0];
          const timeSince = Math.floor(new Date(afk_since).getTime() / 1000);
          await message.reply({
            content: `💤 **${mentionedUser.username}** is currently AFK: *${reason}* (<t:${timeSince}:R>)`,
          }).catch(() => null);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error checking AFK status');
  }

  // 2. Whitelist & Anti-Spam Check
  const exemptFromSpam = await isExempt(message, 'SPAM');
  if (!exemptFromSpam) {
    const caughtSpam = await processAntiSpam(message);
    if (caughtSpam) return; // Kicked / Handled
  }

  // 3. Anti-Scam & Phishing Check
  const exemptFromScam = await isExempt(message, 'SCAM');
  if (!exemptFromScam) {
    const caughtScam = await processAntiScam(message);
    if (caughtScam) return;
  }

  // 3. Anti-Link Enforcement
  try {
    const settingsRes = await db.query(
      `SELECT anti_links, level_channel_id, xp_rate FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );
    const settings = settingsRes.rows[0] || {};

    if (settings.anti_links) {
      const linkRegex = /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+)/gi;
      if (linkRegex.test(message.content)) {
        if (!message.member?.permissions.has('Administrator')) {
          if (message.deletable) await message.delete();
          if (message.channel instanceof TextChannel) {
            const warnMsg = await message.channel.send(
              `⚠️ <@${userId}>, posting links is prohibited on this server.`
            );
            setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
          }
          return;
        }
      }
    }

    // 4. Automated Leveling XP Progression
    const now = Date.now();
    const cooldownKey = `${guildId}:${userId}`;
    const lastXpTime = xpCooldowns.get(cooldownKey) || 0;

    if (now - lastXpTime >= 60000) { // 60-second cooldown
      xpCooldowns.set(cooldownKey, now);

      const multiplier = Number(settings.xp_rate) || 1.0;
      const gainedXp = Math.floor((Math.floor(Math.random() * 11) + 15) * multiplier);

      // Fetch or initialize user economy record
      const userRes = await db.query(
        `SELECT xp, level FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId]
      );

      const currentXp = Number(userRes.rows[0]?.xp) || 0;
      const currentLevel = Number(userRes.rows[0]?.level) || 1;
      const newTotalXp = currentXp + gainedXp;

      // Formula: Level L requires (L * 150) XP
      const calculatedLevel = Math.max(1, Math.floor(newTotalXp / 150) + 1);

      await db.query(
        `INSERT INTO user_economy (guild_id, user_id, xp, level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id, user_id) DO UPDATE SET
           xp = $3,
           level = $4`,
        [guildId, userId, newTotalXp, calculatedLevel]
      );

      // Level Up Event
      if (calculatedLevel > currentLevel) {
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
          .setDescription(`Congratulations <@${userId}>! You advanced to **Level ${calculatedLevel}**! ⭐`)
          .setThumbnail(message.author.displayAvatarURL());

        await announcementChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error in messageCreate extended pipeline');
  }
}