import { Message } from 'discord.js';
import { logSecurityEvent } from './logger';
import { logger } from '../core/logger';

const SCAM_PATTERNS = [
  /free\s+nitro/i,
  /steam\s*gift/i,
  /crypto\s*airdrop/i,
  /claim\s*your\s*reward/i,
  /dlscord\.gg/i, // Typosquatting
  /discoord/i,
  /gift\s*card\s*generator/i,
];

export async function processAntiScam(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;

  const content = message.content;
  const matchedPattern = SCAM_PATTERNS.find((pattern) => pattern.test(content));

  if (matchedPattern) {
    const reason = `Scam/Phishing Pattern Matched (${matchedPattern.source})`;

    try {
      // 1. Delete scam message
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
        eventType: 'SCAM',
        reason: 'Scam / Phishing Pattern Detected',
        details: `Message contained flagged phrase in <#${message.channel.id}>: \`${content.slice(0, 100)}\``,
      });

      return true;
    } catch (err) {
      logger.error({ err, userId: message.author.id }, 'Failed to execute auto-kick for scam');
    }
  }

  return false;
}