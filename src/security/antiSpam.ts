import { Message } from 'discord.js';
import { logSecurityEvent } from './logger';
import { logger } from '../core/logger';

interface MessageCache {
  timestamps: number[];
  contents: string[];
}

const userTracker = new Map<string, MessageCache>();

export async function processAntiSpam(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;

  const userId = message.author.id;
  const now = Date.now();
  const windowMs = 5000; // 5-second window
  const maxMessages = 5; // Max 5 messages in 5 sec

  let tracking = userTracker.get(userId);
  if (!tracking) {
    tracking = { timestamps: [], contents: [] };
    userTracker.set(userId, tracking);
  }

  // Clean old entries
  tracking.timestamps = tracking.timestamps.filter((t) => now - t < windowMs);
  tracking.timestamps.push(now);
  tracking.contents.push(message.content);

  // Keep contents array in sync
  if (tracking.contents.length > tracking.timestamps.length) {
    tracking.contents = tracking.contents.slice(-tracking.timestamps.length);
  }

  // Check frequency threshold
  const isFrequencySpam = tracking.timestamps.length >= maxMessages;
  const isDuplicateSpam = tracking.contents.length >= 3 && tracking.contents.every((c) => c === message.content);

  if (isFrequencySpam || isDuplicateSpam) {
    const reason = isFrequencySpam ? 'Message Flooding Detected' : 'Repeated Message Spam Detected';

    try {
      // 1. Delete message
      if (message.deletable) await message.delete();

      // 2. DIRECT KICK
      if (message.member.kickable) {
        await message.member.kick(`[SRB NEXUS AUTO-MOD] ${reason}`);
      }

      // 3. Log Event
      await logSecurityEvent({
        guild: message.guild,
        userId: message.author.id,
        userTag: message.author.tag,
        action: 'DIRECT_KICK',
        eventType: 'SPAM',
        reason,
        details: `Sent ${tracking.timestamps.length} msgs within ${windowMs / 1000}s in <#${message.channel.id}>`,
      });

      userTracker.delete(userId);
      return true;
    } catch (err) {
      logger.error({ err, userId }, 'Failed to execute direct auto-kick for spam');
    }
  }

  return false;
}