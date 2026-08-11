import { Guild } from 'discord.js';
import { logger } from '../../core/logger';
import { db } from '../../core/database';

export async function handleGuildCreate(guild: Guild): Promise<void> {
  logger.info({ guildId: guild.id, name: guild.name }, 'Joined new guild. Provisioning settings...');

  await db.query(`INSERT INTO guilds (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`, [guild.id]);
  await db.query(`INSERT INTO guild_security_config (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`, [guild.id]);
}