import { apiServer, startServer } from '../api/server';
import { db } from './database';
import { logger } from './logger';

export class Application {
  public async start(): Promise<void> {
    try {
      logger.info('Starting SRB NEXUS Production Engine...');
      
      // Connect to database
      await db.connect();

      // Start REST API server
      const port = Number(process.env.PORT) || 10000;
      await startServer(port);

      logger.info('SRB NEXUS Platform fully online and hardened');
    } catch (err) {
      logger.fatal({ err }, 'Failed to start application engine');
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Graceful shutdown signal received');
    await apiServer.close();
    await db.disconnect();
    logger.info('SRB NEXUS shutdown complete');
  }
}

export const app = new Application();