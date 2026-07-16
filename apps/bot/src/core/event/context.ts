/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Event execution context.
 * =========================================================
 */

/**
 * Represents an event execution context.
 */
export interface EventContext<T = unknown> {
  /**
   * Event identifier.
   */
  readonly event: string;

  /**
   * Event payload.
   */
  readonly payload: T;

  /**
   * Event creation timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Factory for creating immutable event contexts.
 */
export class EventContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates an immutable event context.
   *
   * @param event Event identifier.
   * @param payload Event payload.
   *
   * @returns Event context.
   */
  public static create<T>(
    event: string,
    payload: T,
  ): Readonly<EventContext<T>> {
    return Object.freeze({
      event,
      payload,
      timestamp: new Date(),
    });
  }
}

export default EventContextFactory;