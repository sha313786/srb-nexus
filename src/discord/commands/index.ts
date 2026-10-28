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
import { createClientCommand } from './createClient';
import { approveClientCommand } from './approveClient';
import { syncStaffNamesCommand } from './syncStaffNames';

// XLANTIS Medical Department Commands
import { xmdTraineeCommand } from './xmdTrainee';
import { xmdPromotionCommand } from './xmdPromotion';

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
import { inviteroleCommand } from './inviterole';
import { verifySetupCommand } from './verifySetup';
import { serverstatsCommand } from './serverstats';
import { tempvoiceCommand } from './tempvoice';
import { tagCommand } from './tag';
import { modmailCommand } from './modmail';
import { serverownerCommand } from './serverowner';
import { spamcatcherCommand } from './spamcatcher';
import { stickyCommand } from './sticky';

// Voice Management Commands
import { muteallCommand, nexusMuteallCommand } from './muteall';
import { unmuteallCommand, nexusUnmuteallCommand } from './unmuteall';
import { moveallCommand, nexusMoveallCommand } from './moveall';

// Music & Audio Streaming Commands
import { playCommand, nexusPlayCommand } from './play';
import { skipCommand, nexusSkipCommand } from './skip';
import { stopCommand, nexusStopCommand } from './stop';
import { pauseCommand, resumeCommand, nexusPauseCommand, nexusResumeCommand } from './pause';
import { queueCommand, nexusQueueCommand } from './queue';
import { nowplayingCommand, npCommand, nexusNowPlayingCommand } from './nowplaying';
import { volumeCommand, nexusVolumeCommand } from './volume';
import { loopCommand, nexusLoopCommand } from './loop';
import { shuffleCommand, nexusShuffleCommand } from './shuffle';

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
  tagCommand,

  // Moderation & Security
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
  verifySetupCommand,

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
  createClientCommand,
  approveClientCommand,
  syncStaffNamesCommand,
  reactionRoleCommand,
  giveawayCommand,
  giveawayRerollCommand,
  streamCommand,
  portfolioCommand,
  inviteroleCommand,
  serverstatsCommand,
  tempvoiceCommand,
  modmailCommand,
  serverownerCommand,
  spamcatcherCommand,
  stickyCommand,
  xmdTraineeCommand,
  xmdPromotionCommand,

  // Voice Management
  muteallCommand,
  nexusMuteallCommand,
  unmuteallCommand,
  nexusUnmuteallCommand,
  moveallCommand,
  nexusMoveallCommand,

  // Music & Audio Streaming
  playCommand,
  nexusPlayCommand,
  skipCommand,
  nexusSkipCommand,
  stopCommand,
  nexusStopCommand,
  pauseCommand,
  resumeCommand,
  nexusPauseCommand,
  nexusResumeCommand,
  queueCommand,
  nexusQueueCommand,
  nowplayingCommand,
  npCommand,
  nexusNowPlayingCommand,
  volumeCommand,
  nexusVolumeCommand,
  loopCommand,
  nexusLoopCommand,
  shuffleCommand,
  nexusShuffleCommand,
];

for (const cmd of allCommands) {
  commandRegistry.set(cmd.data.name, cmd);
}

const srbStudioOnlyNames = new Set([
  'nexus-quotation',
  'nexus-portfolio',
  'create-client',
  'approve-client',
  'sync-staff-names',
]);

const xmdOnlyNames = new Set([
  'xmd-trainee',
  'xmd-promotion',
]);

export async function registerSlashCommands(clientId: string): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);
  
  // Public commands for all servers
  const globalCommandsJSON = Array.from(commandRegistry.values())
    .filter((cmd) => !srbStudioOnlyNames.has(cmd.data.name) && !xmdOnlyNames.has(cmd.data.name))
    .map((cmd) => cmd.data.toJSON());

  // Private SRB Studio exclusive commands
  const srbStudioCommandsJSON = Array.from(commandRegistry.values())
    .filter((cmd) => srbStudioOnlyNames.has(cmd.data.name))
    .map((cmd) => cmd.data.toJSON());

  // Private XLANTIS Medical Department exclusive commands
  const xmdCommandsJSON = Array.from(commandRegistry.values())
    .filter((cmd) => xmdOnlyNames.has(cmd.data.name))
    .map((cmd) => cmd.data.toJSON());

  try {
    logger.info(`Registering ${globalCommandsJSON.length} global public slash commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: globalCommandsJSON });

    logger.info(`Registering ${srbStudioCommandsJSON.length} SRB Studio exclusive commands...`);
    await rest.put(Routes.applicationGuildCommands(clientId, '1525065834572021851'), {
      body: srbStudioCommandsJSON,
    });

    logger.info(`Registering ${xmdCommandsJSON.length} XLANTIS Medical Department exclusive commands...`);
    await rest.put(Routes.applicationGuildCommands(clientId, '1525390373281857546'), {
      body: xmdCommandsJSON,
    });

    // Clear guild commands on test server so only global commands show there
    await rest.put(Routes.applicationGuildCommands(clientId, '1526864208011067433'), { body: [] }).catch(() => {});
    logger.info(`Successfully registered global, SRB Studio, and XMD slash commands`);
  } catch (err) {
    logger.error({ err }, 'Failed to register slash commands');
  }
}
