import './dnsFallback';
import { Pool } from 'pg';
import { logger } from './logger';

export class DatabaseService {
  private connected: boolean = false;
  private client: Pool | null = null;

  public get isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    try {
      const isLocal =
        !process.env.DATABASE_URL ||
        process.env.DATABASE_URL.includes('localhost') ||
        process.env.DATABASE_URL.includes('127.0.0.1') ||
        process.env.DATABASE_URL.includes('@postgres:');

      const useSsl =
        process.env.DB_SSL === 'true' ||
        (process.env.NODE_ENV === 'production' && !isLocal) ||
        (process.env.DATABASE_URL?.includes('sslmode=require') ?? false);

      // Initialize the database connection client/pool with idle connection reaping and error resilience
      this.client = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Handle idle client connection errors (e.g. Neon serverless idle disconnects)
      // to prevent unhandled EventEmitter error crashes
      this.client.on('error', (err: Error) => {
        logger.error({ err }, '[DATABASE] Unexpected error on idle database client in pool (auto-reconnected)');
      });

      // Verify connection with a ping
      await this.client.query('SELECT 1');

      this.connected = true;
      logger.info('Database connection established successfully');
    } catch (err) {
      this.connected = false;
      logger.error({ err }, 'Failed to connect to database');
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
    }
    this.connected = false;
    logger.info('Database disconnected');
  }

  public async query<T = any>(text: string, params?: any[]): Promise<any> {
    if (!this.client || !this.connected) {
      throw new Error('Database is not connected');
    }
    return this.client.query(text, params);
  }
}

export const db = new DatabaseService();
