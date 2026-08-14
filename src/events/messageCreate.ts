// Path: src/events/messageCreate.ts
import { Message, TextChannel } from 'discord.js';
import { db } from '../core/database';

export async function handleMessageCreate(message: Message) {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;

  // --- 1. MODERATION MODULE (Anti-Links) ---
  try {
    const modRes = await db.query(
      'SELECT anti_links FROM module_moderation WHERE guild_id = $1',
      [guildId]
    );

    if (modRes.rows[0]?.anti_links) {
      const linkRegex = /(https?:\/\/[^\s]+)/g;
      if (linkRegex.test(message.content)) {
        // Exempt administrators
        if (!message.member?.permissions.has('Administrator')) {
          await message.delete();
          const warning = await message.channel.send(
            `⚠️ ${message.author}, posting links is disabled in this server.`
          );
          setTimeout(() => warning.delete().catch(() => {}), 5000);
          return;
        }
      }
    }
  } catch (err) {
    console.error('Error handling anti-links:', err);
  }

  // --- 2. LEVELING MODULE (XP Gain) ---
  try {
    const levelRes = await db.query(
      'SELECT * FROM module_levels WHERE guild_id = $1 AND enabled = TRUE',
      [guildId]
    );

    if (levelRes.rows.length > 0) {
      const config = levelRes.rows[0];
      const xpRate = config.xp_rate || 1.0;
      const xpGained = Math.floor((Math.floor(Math.random() * 10) + 15) * xpRate);

      // Fetch or initialize user economy/level data
      const userRes = await db.query(
        'SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2',
        [guildId, message.author.id]
      );

      if (userRes.rows.length === 0) {
        await db.query(
          'INSERT INTO user_economy (guild_id, user_id, balance) VALUES ($1, $2, $3)',
          [guildId, message.author.id, xpGained]
        );
      } else {
        await db.query(
          'UPDATE user_economy SET balance = balance + $1 WHERE guild_id = $2 AND user_id = $3',
          [xpGained, guildId, message.author.id]
        );
      }
    }
  } catch (err) {
    console.error('Error handling leveling XP:', err);
  }
}