/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : emitter.ts
 * Purpose : Centralized event emitter.
 * =========================================================
 */

import { EventDispatcher } from "./dispatcher.js";

/**
 * Centralized event emitter.
 *
 * Provides a single entry point for emitting
 * framework events.
 */
export class EventEmitter {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Emits an event.
   *
   * @param event Event name.
   * @param payload Event payload.
   */
  public static async emit<T>(
    event: string,
    payload: T,
  ): Promise<void> {
    await EventDispatcher.dispatch(
      event,
      payload,
    );
  }

  /**
   * Emits an event without a payload.
   *
   * @param event Event name.
   */
  public static async emitEmpty(
    event: string,
  ): Promise<void> {
    await EventDispatcher.dispatch(
      event,
      undefined,
    );
  }
}

export default EventEmitter;