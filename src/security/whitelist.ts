import { Message } from 'discord.js';
import { db } from '../core/database';

export async function isExempt(message: Message, scope: 'SPAM' | 'SCAM' | 'RAID' | 'ALL'): Promise<boolean> {
  // Always exempt bot owner/management or self
  if (message.author.id === message.client.user?.id) return true;
  if (message.webhookId) return true;

  if (!message.guild) return false;

  // Query exemptions from Supabase
  const roleIds = message.member?.roles.cache.map((r) => r.id) || [];
  
  const query = `
    SELECT entity_type, entity_id 
    FROM guild_exemptions 
    WHERE guild_id = $1 
      AND (exemption_scope = 'ALL' OR exemption_scope = $2)
  `;
  
  const { rows } = await db.query(query, [message.guild.id, scope]);

  for (const exemption of rows) {
    if (exemption.entity_type === 'USER' && exemption.entity_id === message.author.id) return true;
    if (exemption.entity_type === 'CHANNEL' && exemption.entity_id === message.channel.id) return true;
    if (exemption.entity_type === 'ROLE' && roleIds.includes(exemption.entity_id)) return true;
    if (exemption.entity_type === 'BOT' && message.author.bot && exemption.entity_id === message.author.id) return true;
  }

  return false;
}