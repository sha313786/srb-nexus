import Fastify from 'fastify';
import { config } from '../core/config';
import { logger } from '../core/logger';
import { healthRoutes } from './routes/health';
import { securityRoutes } from './routes/security';

export class ApiServer {
  private app = Fastify({ logger: false });

  public async start(): Promise<void> {
    // Register Route Handler Modules
    await this.app.register(healthRoutes);
    await this.app.register(securityRoutes);

    const port = parseInt(process.env.PORT || '3000', 10);
    const host = '0.0.0.0';

    try {
      await this.app.listen({ port, host });
      logger.info(`Fastify REST API server running on http://${host}:${port}`);
    } catch (err) {
      logger.error({ err }, 'Failed to start Fastify REST API');
      throw err;
    }
  }

  public async stop(): Promise<void> {
    await this.app.close();
    logger.info('Fastify REST API server stopped');
  }
}

export const apiServer = new ApiServer();