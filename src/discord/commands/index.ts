import { REST, Routes } from 'discord.js';
import { config } from '../../core/config';
import { logger } from '../../core/logger';

// Utility & Core Commands
import { pingCommand } from './ping';
import { helpCommand } from './help';
import { serverinfoCommand } from './serverinfo';
import { userinfoCommand } from './userinfo';
import { avatarCommand } from './avatar';
import { pollCommand } from './poll';

// Moderation & Defense Commands
import { lockdownCommand } from './lockdown';
import { kickCommand } from './kick';
import { banCommand } from './ban';
import { timeoutCommand } from './timeout';
import { purgeCommand } from './purge';
import { slowmodeCommand } from './slowmode';
import { warnCommand } from './warn';
import { warningsCommand } from './warnings';
import { clearwarnCommand } from './clearwarn';
import { modlogsCommand } from './modlogs';

// Leveling & Progression Commands
import { rankCommand } from './rank';
import { leaderboardCommand } from './leaderboard';

// Economy & Casino Commands
import { balanceCommand } from './balance';
import { dailyCommand } from './daily';
import { workCommand } from './work';
import { coinflipCommand } from './coinflip';
import { payCommand } from './pay';

// Support Ticket Commands
import { ticketCommand } from './ticket';
import { ticketSetupCommand } from './ticketSetup';
import { quotationCommand } from './quotation';

// Advanced Multipurpose Commands
import { reactionRoleCommand } from './reactionrole';
import { giveawayCommand } from './giveaway';
import { giveawayRerollCommand } from './giveawayReroll';
import { remindCommand } from './remind';
import { afkCommand } from './afk';
import { slotsCommand } from './slots';
import { robCommand } from './rob';
import { embedCommand } from './embed';
import { streamCommand } from './stream';
import { portfolioCommand } from './portfolio';

export const commandRegistry = new Map<string, any>();

const allCommands = [
  // Utility & Core
  pingCommand,
  helpCommand,
  serverinfoCommand,
  userinfoCommand,
  avatarCommand,
  pollCommand,
  embedCommand,
  remindCommand,
  afkCommand,

  // Moderation
  lockdownCommand,
  kickCommand,
  banCommand,
  timeoutCommand,
  purgeCommand,
  slowmodeCommand,
  warnCommand,
  warningsCommand,
  clearwarnCommand,
  modlogsCommand,

  // Leveling
  rankCommand,
  leaderboardCommand,

  // Economy & Casino
  balanceCommand,
  dailyCommand,
  workCommand,
  coinflipCommand,
  payCommand,
  slotsCommand,
  robCommand,

  // Tickets & Engagement
  ticketCommand,
  ticketSetupCommand,
  quotationCommand,
  reactionRoleCommand,
  giveawayCommand,
  giveawayRerollCommand,
  streamCommand,
  portfolioCommand,
];

for (const cmd of allCommands) {
  commandRegistry.set(cmd.data.name, cmd);
}

export async function registerSlashCommands(clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  const commandsJSON = Array.from(commandRegistry.values()).map((cmd) => cmd.data.toJSON());

  try {
    logger.info(`Registering ${commandsJSON.length} global slash commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandsJSON });
    // Also register directly to SRB Studio for instant Discord UI update
    await rest.put(Routes.applicationGuildCommands(clientId, '1525065834572021851'), { body: commandsJSON }).catch(() => {});
    logger.info(`Successfully registered ${commandsJSON.length} slash commands with Discord API`);
  } catch (err) {
    logger.error({ err }, 'Failed to register slash commands');
  }
}