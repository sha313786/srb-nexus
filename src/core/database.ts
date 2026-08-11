import { logger } from './logger';

export class DatabaseService {
  private connected: boolean = false;
  private client: any; // Replace 'any' with your actual database client type (e.g., Pool or SupabaseClient)

  // Getter for health check
  public get isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    try {
      // Connect logic
      this.connected = true;
      logger.info('Database connection established successfully');
    } catch (err) {
      this.connected = false;
      logger.error({ err }, 'Failed to connect to database');
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('Database disconnected');
  }

  // Wrapper method for SQL queries
  public async query<T = any>(text: string, params?: any[]): Promise<T> {
    if (!this.connected) {
      throw new Error('Database is not connected');
    }
    // If using pg Pool / Client:
    return this.client.query(text, params);
  }
}

export const db = new DatabaseService();