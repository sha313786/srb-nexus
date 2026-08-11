import { Message } from 'discord.js';
import { isExempt } from '../../security/whitelist';
import { processAntiSpam } from '../../security/antiSpam';
import { processAntiScam } from '../../security/antiScam';

export async function handleMessageCreate(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  // 1. Whitelist Check
  const exemptFromSpam = await isExempt(message, 'SPAM');
  if (!exemptFromSpam) {
    const caughtSpam = await processAntiSpam(message);
    if (caughtSpam) return; // Terminate pipeline if kicked
  }

  const exemptFromScam = await isExempt(message, 'SCAM');
  if (!exemptFromScam) {
    const caughtScam = await processAntiScam(message);
    if (caughtScam) return;
  }
}