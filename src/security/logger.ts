import { Guild, EmbedBuilder, TextChannel } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

interface SecurityAuditOptions {
  guild: Guild;
  userId: string;
  userTag: string;
  action: 'DIRECT_KICK' | 'BAN' | 'LOCKDOWN' | 'TIMEOUT';
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
      `SELECT COALESCE(
        (SELECT logging_channel_id FROM guild_security_config WHERE guild_id = $1),
        (SELECT log_channel_id FROM guild_settings WHERE guild_id = $1)
       ) AS logging_channel_id`,
      [opts.guild.id]
    ).catch(() => ({ rows: [] }));

    const logChannelId = rows[0]?.logging_channel_id;
    if (logChannelId) {
      const channel = await opts.guild.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel instanceof TextChannel) {
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

        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    logger.error({ err }, 'Failed to send security audit embed to Discord channel');
  }

  // 3. Dispatch Sovereign Owner Direct DM Alert if enabled
  try {
    const ownerRes = await db.query(
      `SELECT owner_dm_alerts FROM guild_owner_config WHERE guild_id = $1`,
      [opts.guild.id]
    ).catch(() => ({ rows: [] }));

    // Defaults to true if row exists and is true, or if no row yet
    const alertsEnabled = ownerRes.rows.length === 0 ? true : ownerRes.rows[0].owner_dm_alerts !== false;

    if (alertsEnabled) {
      const owner = await opts.guild.fetchOwner().catch(() => null);
      if (owner) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`🛡️ [SRB NEXUS] Security Alert in ${opts.guild.name}`)
          .setDescription(`A critical security defense action was triggered in your server **${opts.guild.name}**.`)
          .setColor(0xe02424)
          .addFields(
            { name: 'Incident Type', value: `\`${opts.eventType}\``, inline: true },
            { name: 'Action Enforced', value: `\`${opts.action}\``, inline: true },
            { name: 'Target User', value: `<@${opts.userId}> (\`${opts.userTag}\`)`, inline: false },
            { name: 'Reason', value: opts.reason, inline: false },
            { name: 'Details', value: opts.details, inline: false }
          )
          .setFooter({ text: 'SRB NEXUS Sovereign Server Owner Alert' })
          .setTimestamp();

        await owner.send({ embeds: [dmEmbed] }).catch(() => {});
      }
    }
  } catch (ownerErr) {
    logger.debug({ ownerErr }, 'Skipped owner direct DM alert dispatch');
  }
}
