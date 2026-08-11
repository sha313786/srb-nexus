export class DatabaseService {
  private connected: boolean = false;

  // Add this getter method:
  public get isConnected(): boolean {
    return this.connected;
  }

  public async connect(): Promise<void> {
    // ... existing connection logic ...
    this.connected = true;
  }

  public async disconnect(): Promise<void> {
    // ... existing disconnect logic ...
    this.connected = false;
  }
}

export const db = new DatabaseService();