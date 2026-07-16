/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : priority.ts
 * Purpose : Event priority definitions and utilities.
 * =========================================================
 */

/**
 * Event execution priority.
 *
 * Lower values execute first.
 */
export enum EventPriority {
  /**
   * Executes before every other listener.
   */
  HIGHEST = 0,

  /**
   * High priority.
   */
  HIGH = 25,

  /**
   * Default priority.
   */
  NORMAL = 50,

  /**
   * Low priority.
   */
  LOW = 75,

  /**
   * Executes after every other listener.
   */
  LOWEST = 100,
}

/**
 * Represents a prioritized event listener.
 */
export interface PrioritizedEventHandler<T = unknown> {
  /**
   * Listener priority.
   */
  readonly priority: EventPriority;

  /**
   * Event callback.
   */
  readonly handler: (payload: T) => void | Promise<void>;
}

/**
 * Utility methods for prioritized listeners.
 */
export class EventPriorityManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Sorts listeners by priority.
   *
   * @param handlers Event handlers.
   *
   * @returns Sorted handlers.
   */
  public static sort<T>(
    handlers: readonly PrioritizedEventHandler<T>[],
  ): PrioritizedEventHandler<T>[] {
    return [...handlers].sort(
      (a, b) => a.priority - b.priority,
    );
  }
}

export default EventPriorityManager;