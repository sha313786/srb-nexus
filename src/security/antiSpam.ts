import { Message } from 'discord.js';
import { logSecurityEvent } from './logger';
import { logger } from '../core/logger';

interface MessageCache {
  timestamps: number[];
  contents: string[];
  violationCount: number;
  lastViolationTime: number;
}

const userTracker = new Map<string, MessageCache>();

// Cleanup stale user records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, tracking] of userTracker.entries()) {
    if (tracking.timestamps.length === 0 || now - tracking.timestamps[tracking.timestamps.length - 1] > 60000) {
      userTracker.delete(userId);
    }
  }
}, 10 * 60 * 1000);

/**
 * SRB NEXUS Spam Catcher & Anti-Spam Pipeline
 * Detects velocity flooding, repeat text spam, and mass mentions.
 * Applies progressive punishment (5-minute timeout on first violation, kick on repeat).
 */
export async function processAntiSpam(message: Message): Promise<boolean> {
  if (!message.guild || !message.member || message.author.bot) return false;

  // Bypass staff with Administrator or Manage Messages
  if (message.member.permissions.has('Administrator') || message.member.permissions.has('ManageMessages')) {
    return false;
  }

  const userId = message.author.id;
  const now = Date.now();
  const windowMs = 4500; // 4.5-second sliding window
  const maxMessages = 5; // Max 5 messages in 4.5 sec
  const maxMentions = 4; // Max 4 mentions per message

  let tracking = userTracker.get(userId);
  if (!tracking) {
    tracking = { timestamps: [], contents: [], violationCount: 0, lastViolationTime: 0 };
    userTracker.set(userId, tracking);
  }

  // Clean old timestamps outside sliding window
  tracking.timestamps = tracking.timestamps.filter((t) => now - t < windowMs);
  tracking.timestamps.push(now);
  tracking.contents.push(message.content);

  // Keep contents array aligned
  if (tracking.contents.length > tracking.timestamps.length) {
    tracking.contents = tracking.contents.slice(-tracking.timestamps.length);
  }

  // 1. Check for Mass Mentions
  const totalMentions = message.mentions.users.size + message.mentions.roles.size;
  const isMassMention = totalMentions > maxMentions;

  // 2. Check for Velocity Flooding & Duplicate Spam
  const isFrequencySpam = tracking.timestamps.length >= maxMessages;
  const isDuplicateSpam = tracking.contents.length >= 3 && tracking.contents.every((c) => c.length > 5 && c === message.content);

  if (isFrequencySpam || isDuplicateSpam || isMassMention) {
    let reason = 'Message Flooding Detected';
    if (isMassMention) reason = `Mass Mention Spam (${totalMentions} mentions)`;
    else if (isDuplicateSpam) reason = 'Repeated Duplicate Message Spam';

    tracking.violationCount++;
    tracking.lastViolationTime = now;

    try {
      // 1. Delete the spam message
      if (message.deletable) {
        await message.delete().catch(() => {});
      }

      // 2. Progressive Action:
      // If first violation: 5-minute timeout (safer, prevents unnecessary bans for false positives)
      // If repeat violation within 10 minutes: Direct kick
      const isRepeatOffender = tracking.violationCount > 1;

      if (isRepeatOffender && message.member.kickable) {
        await message.member.kick(`[SRB NEXUS SPAM CATCHER] Repeat offense: ${reason}`);
        await logSecurityEvent({
          guild: message.guild,
          userId: message.author.id,
          userTag: message.author.tag,
          action: 'DIRECT_KICK',
          eventType: 'SPAM',
          reason,
          details: `Repeat violation (${tracking.violationCount}) within window. Sent ${tracking.timestamps.length} msgs in <#${message.channel.id}>`,
        });
        userTracker.delete(userId);
      } else if (message.member.moderatable) {
        // 5-minute native timeout
        const timeoutDuration = 5 * 60 * 1000;
        await message.member.timeout(timeoutDuration, `[SRB NEXUS SPAM CATCHER] ${reason}`);

        // Ephemeral / channel warning
        if ('send' in message.channel && typeof message.channel.send === 'function') {
          const warning = await message.channel.send({
            content: `🛡️ <@${userId}> has been muted for 5 minutes. **Reason**: ${reason}`,
          }).catch(() => null);
          if (warning) setTimeout(() => warning.delete().catch(() => {}), 6000);
        }

        await logSecurityEvent({
          guild: message.guild,
          userId: message.author.id,
          userTag: message.author.tag,
          action: 'TIMEOUT',
          eventType: 'SPAM',
          reason,
          details: `1st strike timeout. Sent ${tracking.timestamps.length} msgs within ${windowMs / 1000}s in <#${message.channel.id}>`,
        });
      }

      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to execute spam catcher mitigation');
    }
  }

  return false;
}
