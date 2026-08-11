import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

interface ModAuditOptions {
  guild: Guild;
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  action: 'KICK' | 'BAN' | 'TIMEOUT' | 'PURGE';
  reason: string;
  durationSec?: number;
}

export async function logModAction(opts: ModAuditOptions): Promise<void> {
  // 1. Record to Supabase
  try {
    await db.query(
      `INSERT INTO moderation_logs (guild_id, target_user_id, moderator_user_id, action, reason, duration_sec)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        opts.guild.id,
        opts.targetId,
        opts.moderatorId,
        opts.action,
        opts.reason,
        opts.durationSec || null,
      ]
    );
  } catch (err) {
    logger.error({ err }, 'Failed to record moderation log in DB');
  }

  // 2. Dispatch embed to logging channel
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
      .setTitle(`🛡️ [MODERATION] ${opts.action}`)
      .setColor(0x3498db)
      .addFields(
        { name: 'Target User', value: `<@${opts.targetId}> (${opts.targetTag})`, inline: true },
        { name: 'Moderator', value: `<@${opts.moderatorId}> (${opts.moderatorTag})`, inline: true },
        { name: 'Reason', value: opts.reason, inline: false }
      )
      .setTimestamp();

    if (opts.durationSec) {
      embed.addFields({ name: 'Duration', value: `${opts.durationSec / 60} minutes`, inline: true });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error({ err }, 'Failed to send moderation audit embed');
  }
}