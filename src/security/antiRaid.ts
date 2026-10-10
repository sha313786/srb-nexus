import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { db } from '../core/database';
import { logSecurityEvent } from './logger';
import { logger } from '../core/logger';
import { broadcastLiveNotification } from '../services/liveNotifications';

interface JoinTracker {
  timestamps: number[];
  memberIds: string[];
}

const raidTracker = new Map<string, JoinTracker>();

export async function processAntiRaid(member: GuildMember): Promise<boolean> {
  const guild = member.guild;
  const now = Date.now();

  try {
    // 1. Fetch guild security config or use defaults
    const configRes = await db.query(
      `SELECT anti_raid_enabled, raid_threshold_joins, raid_window_seconds, raid_action 
       FROM guild_security_config 
       WHERE guild_id = $1`,
      [guild.id]
    ).catch(() => ({ rows: [] }));

    const config = configRes.rows[0] || {};
    const isEnabled = config.anti_raid_enabled ?? true;
    if (!isEnabled) return false;

    const threshold = config.raid_threshold_joins || 5;
    const windowMs = (config.raid_window_seconds || 10) * 1000;
    const action = config.raid_action || 'LOCKDOWN';

    // 2. Track joins in memory
    let tracker = raidTracker.get(guild.id);
    if (!tracker) {
      tracker = { timestamps: [], memberIds: [] };
      raidTracker.set(guild.id, tracker);
    }

    // Clean old joins outside the window
    const validIndices = tracker.timestamps
      .map((t, idx) => (now - t < windowMs ? idx : -1))
      .filter((idx) => idx !== -1);

    tracker.timestamps = validIndices.map((i) => tracker!.timestamps[i]);
    tracker.memberIds = validIndices.map((i) => tracker!.memberIds[i]);

    tracker.timestamps.push(now);
    tracker.memberIds.push(member.id);

    // 3. Raid Detected if join count exceeds threshold
    if (tracker.timestamps.length >= threshold) {
      const reason = `Anti-Raid Triggered: ${tracker.timestamps.length} joins detected in ${windowMs / 1000}s`;
      logger.warn({ guildId: guild.id, joins: tracker.timestamps.length }, reason);

      // Attempt to take action on the raid member if configured
      if (action === 'KICK' && member.kickable) {
        await member.kick(`[SRB NEXUS ANTI-RAID] Mass join raid protection`).catch((err) =>
          logger.error({ err }, 'Failed to kick member during anti-raid')
        );
      }

      // Log Security Event
      await logSecurityEvent({
        guild,
        userId: member.id,
        userTag: member.user.tag,
        action: 'LOCKDOWN',
        eventType: 'RAID',
        reason,
        details: `${tracker.timestamps.length} users joined within ${windowMs / 1000}s. Action: ${action}`,
      });

      // Real-time Live Alert Broadcast
      await broadcastLiveNotification(guild.client, guild.id, {
        type: 'security',
        title: '🚨 ANTI-RAID DEFENSE ACTIVATED',
        description: reason,
        severity: 'critical',
        fields: [
          { name: 'Joins Detected', value: `${tracker.timestamps.length} joins`, inline: true },
          { name: 'Time Window', value: `${windowMs / 1000}s`, inline: true },
          { name: 'Action Enforced', value: action, inline: true },
        ],
      }).catch(() => {});

      return true;
    }
  } catch (err) {
    logger.error({ err }, 'Error in anti-raid processing pipeline');
  }

  return false;
}
