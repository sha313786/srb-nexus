import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { logger } from '../core/logger';
import { config } from '../core/config';

export class DiscordService {
  public client: Client;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    });
  }

  public async connect(): Promise<void> {
    logger.info('Connecting to Discord Gateway...');
    await this.client.login(config.DISCORD_TOKEN);
  }

  public async disconnect(): Promise<void> {
    if (this.client.isReady()) {
      this.client.destroy();
      logger.info('Disconnected from Discord Gateway');
    }
  }
}

export const discordService = new DiscordService();