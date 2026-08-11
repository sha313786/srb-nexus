import { Pool } from 'pg';
import { config } from './config';
import { logger } from './logger';

export class DatabaseService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error');
    });
  }

  public async connect(): Promise<void> {
    const client = await this.pool.connect();
    logger.info('Database connection established successfully');
    client.release();
  }

  public async query(text: string, params?: any[]) {
    return this.pool.query(text, params);
  }

  public async disconnect(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}

export const db = new DatabaseService();