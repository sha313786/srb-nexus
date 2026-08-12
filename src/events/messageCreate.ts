import { Message } from 'discord.js';
import { db } from '../core/database';

// Cooldown tracker to prevent spamming XP
const xpCooldowns = new Set<string>();

export async function handleMessageXP(message: Message) {
  if (message.author.bot || !message.guild) return;

  const key = `${message.guild.id}-${message.author.id}`;
  if (xpCooldowns.has(key)) return;

  try {
    const res = await db.query(
      'SELECT xp_rate, enabled FROM module_levels WHERE guild_id = $1',
      [message.guild.id]
    );

    const settings = res.rows[0];
    if (settings && settings.enabled === false) return;

    const xpRate = settings?.xp_rate || 1.0;
    const xpGained = Math.floor((Math.floor(Math.random() * 10) + 15) * xpRate);

    // Save XP to user_levels table
    await db.query(
      `INSERT INTO user_levels (guild_id, user_id, xp, level)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         xp = user_levels.xp + EXCLUDED.xp`,
      [message.guild.id, message.author.id, xpGained]
    );

    // Set 60-second cooldown
    xpCooldowns.add(key);
    setTimeout(() => xpCooldowns.delete(key), 60000);
  } catch (err) {
    console.error(`Error processing XP for message in guild ${message.guild.id}:`, err);
  }
}