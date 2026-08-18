import { REST, Routes } from 'discord.js';
import { config } from '../../core/config';
import { logger } from '../../core/logger';
import { pingCommand } from './ping';
import { lockdownCommand } from './lockdown';
import { kickCommand } from './kick';
import { banCommand } from './ban';
import { timeoutCommand } from './timeout';
import { purgeCommand } from './purge';
import { modlogsCommand } from './modlogs';
import { ticketCommand } from './ticket'; // 1. Import

export const commandRegistry = new Map<string, any>();
commandRegistry.set(pingCommand.data.name, pingCommand);
commandRegistry.set(lockdownCommand.data.name, lockdownCommand);
commandRegistry.set(kickCommand.data.name, kickCommand);
commandRegistry.set(banCommand.data.name, banCommand);
commandRegistry.set(timeoutCommand.data.name, timeoutCommand);
commandRegistry.set(purgeCommand.data.name, purgeCommand);
commandRegistry.set(modlogsCommand.data.name, modlogsCommand);
commandRegistry.set(ticketCommand.data.name, ticketCommand); // 2. Register

export async function registerSlashCommands(clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const commandsJSON = Array.from(commandRegistry.values()).map((cmd) => cmd.data.toJSON());

  try {
    logger.info(`Registering ${commandsJSON.length} global slash commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandsJSON });
    logger.info('Global slash commands registered successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to register slash commands');
  }
}