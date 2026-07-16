/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : dispatcher.ts
 * Purpose : Centralized event dispatcher.
 * =========================================================
 */

/**
 * Generic event callback.
 */
export type EventHandler<T = unknown> = (
  payload: T,
) => void | Promise<void>;

/**
 * Centralized event dispatcher.
 *
 * Responsible for dispatching events to all
 * registered listeners.
 */
export class EventDispatcher {
  /**
   * Registered event listeners.
   */
  private static readonly listeners = new Map<
    string,
    Set<EventHandler>
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers an event handler.
   *
   * @param event Event name.
   * @param handler Event callback.
   */
  public static on<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    if (!EventDispatcher.listeners.has(event)) {
      EventDispatcher.listeners.set(event, new Set());
    }

    EventDispatcher.listeners
      .get(event)!
      .add(handler as EventHandler);
  }

  /**
   * Removes an event handler.
   *
   * @param event Event name.
   * @param handler Event callback.
   */
  public static off<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    EventDispatcher.listeners
      .get(event)
      ?.delete(handler as EventHandler);

    if (
      EventDispatcher.listeners.get(event)?.size === 0
    ) {
      EventDispatcher.listeners.delete(event);
    }
  }

  /**
   * Dispatches an event.
   *
   * @param event Event name.
   * @param payload Event payload.
   */
  public static async dispatch<T>(
    event: string,
    payload: T,
  ): Promise<void> {
    const handlers =
      EventDispatcher.listeners.get(event);

    if (!handlers) {
      return;
    }

    for (const handler of handlers) {
      await handler(payload);
    }
  }

  /**
   * Determines whether an event has listeners.
   *
   * @param event Event name.
   *
   * @returns True if listeners exist.
   */
  public static has(event: string): boolean {
    return (
      EventDispatcher.listeners.has(event) &&
      EventDispatcher.listeners.get(event)!.size > 0
    );
  }

  /**
   * Removes every registered listener.
   */
  public static clear(): void {
    EventDispatcher.listeners.clear();
  }
}

export default EventDispatcher;