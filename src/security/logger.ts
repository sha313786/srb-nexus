import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

interface SecurityAuditOptions {
  guild: Guild;
  userId: string;
  userTag: string;
  action: 'DIRECT_KICK' | 'BAN' | 'LOCKDOWN';
  reason: string;
  eventType: 'SPAM' | 'SCAM' | 'RAID';
  details: string;
}

export async function logSecurityEvent(opts: SecurityAuditOptions): Promise<void> {
  // 1. Persist to DB
  try {
    await db.query(
      `INSERT INTO security_events (guild_id, user_id, event_type, reason, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        opts.guild.id,
        opts.userId,
        `${opts.eventType}_${opts.action}`,
        opts.reason,
        JSON.stringify({ userTag: opts.userTag, details: opts.details }),
      ]
    );
  } catch (err) {
    logger.error({ err }, 'Failed to persist security log to DB');
  }

  // 2. Fetch guild logging channel config
  try {
    const { rows } = await db.query(
      `SELECT logging_channel_id FROM guild_security_config WHERE guild_id = $1`,
      [opts.guild.id]
    );

    const logChannelId = rows[0]?.logging_channel_id;
    if (!logChannelId) return;

    const channel = await opts.guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !(channel instanceof TextChannel)) return;

    const embed = new EmbedBuilder()
      .setTitle(`🚨 [SECURITY ACTION] ${opts.eventType} DETECTED`)
      .setColor(0xff0000)
      .addFields(
        { name: 'User', value: `<@${opts.userId}> (${opts.userTag})`, inline: true },
        { name: 'Action Enforced', value: `\`${opts.action}\``, inline: true },
        { name: 'Reason', value: opts.reason, inline: false },
        { name: 'Details', value: opts.details, inline: false }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, 'Failed to send security audit embed to Discord channel');
  }
}