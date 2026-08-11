import { EventEmitter } from 'events';
import { logger } from './logger';

class NexusEventBus extends EventEmitter {
  public emitAsync(event: string, ...args: any[]): Promise<void> {
    const listeners = this.listeners(event);
    const promises = listeners.map((listener) => {
      try {
        return Promise.resolve(listener(...args));
      } catch (err) {
        logger.error({ err, event }, 'Error executing event listener');
        return Promise.resolve();
      }
    });

    return Promise.all(promises).then(() => undefined);
  }
}

export const eventBus = new NexusEventBus();