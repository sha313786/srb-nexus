import { config } from './config';
import { logger } from './logger';
import { db } from './database';
import { discordService } from '../discord/client';
import { apiServer } from '../api/server';
import { enforceProductionHardening } from './security';
import { handleReady } from '../discord/events/ready';
import { handleGuildCreate } from '../discord/events/guildCreate';
import { handleInteractionCreate } from '../discord/events/interactionCreate';
import { handleMessageCreate } from '../discord/events/messageCreate';

export class Application {
  private isShuttingDown = false;

  public async start(): Promise<void> {
    // 0. Enforce Production Security & Hardening Policies
    enforceProductionHardening();

    logger.info({ env: config.NODE_ENV }, 'Starting SRB NEXUS Production Engine...');

    this.registerSignalHandlers();

    try {
      // 1. Database Connection
      await db.connect();

      // 2. Discord Handlers
     discordService.client.once('clientReady', () => handleReady(discordService.client));
      discordService.client.on('guildCreate', handleGuildCreate);
      discordService.client.on('interactionCreate', handleInteractionCreate);
      discordService.client.on('messageCreate', handleMessageCreate);

      // 3. Connect Discord Client
      await discordService.connect();

      // 4. Start Fastify REST API Server
      await apiServer.start();

      logger.info('SRB NEXUS Platform fully online and hardened');
    } catch (err) {
      logger.fatal({ err }, 'Failed to initialize application');
      process.exit(1);
    }
  }

  public async stop(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown signal received');

    const shutdownTimeout = setTimeout(() => {
      logger.error('Shutdown timed out. Forcing process exit');
      process.exit(1);
    }, 10000);

    try {
      await apiServer.stop();
      await discordService.disconnect();
      await db.disconnect();

      logger.info('SRB NEXUS shutdown complete');
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error encountered during shutdown');
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  }

  private registerSignalHandlers(): void {
    process.on('SIGINT', () => this.stop('SIGINT'));
    process.on('SIGTERM', () => this.stop('SIGTERM'));

    process.on('uncaughtException', (err) => {
      logger.fatal({ err }, 'Uncaught Exception detected');
      this.stop('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ reason }, 'Unhandled Rejection detected');
      this.stop('unhandledRejection');
    });
  }
}