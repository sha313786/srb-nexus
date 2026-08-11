import { Client } from 'discord.js';
import { logger } from '../../core/logger';
import { registerSlashCommands } from '../commands';
import { db } from '../../core/database';

export async function handleReady(client: Client): Promise<void> {
  if (!client.user) return;

  logger.info({ botUser: client.user.tag }, 'Discord Bot connection established');

  // Register commands globally
  await registerSlashCommands(client.user.id);

  // Sync connected guilds to PostgreSQL/Supabase
  const guilds = await client.guilds.fetch();
  for (const [guildId] of guilds) {
    await db.query(
      `INSERT INTO guilds (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
      [guildId]
    );
    await db.query(
      `INSERT INTO guild_security_config (guild_id) VALUES ($1) ON CONFLICT (guild_id) DO NOTHING`,
      [guildId]
    );
  }

  logger.info(`Synchronized ${guilds.size} guild configurations to database`);
}