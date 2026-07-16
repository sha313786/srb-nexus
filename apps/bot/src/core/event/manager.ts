/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Centralized event manager.
 * =========================================================
 */

import { EventEmitter } from "./emitter.js";
import { EventListener } from "./listener.js";
import {
  type EventHandler,
} from "./dispatcher.js";

/**
 * Centralized event manager.
 *
 * Provides a unified interface for working with
 * framework events.
 */
export class EventManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers an event listener.
   *
   * @param event Event identifier.
   * @param handler Event callback.
   */
  public static on<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    EventListener.subscribe(event, handler);
  }

  /**
   * Removes an event listener.
   *
   * @param event Event identifier.
   * @param handler Event callback.
   */
  public static off<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    EventListener.unsubscribe(event, handler);
  }

  /**
   * Emits an event.
   *
   * @param event Event identifier.
   * @param payload Event payload.
   */
  public static async emit<T>(
    event: string,
    payload: T,
  ): Promise<void> {
    await EventEmitter.emit(
      event,
      payload,
    );
  }

  /**
   * Emits an event without a payload.
   *
   * @param event Event identifier.
   */
  public static async emitEmpty(
    event: string,
  ): Promise<void> {
    await EventEmitter.emitEmpty(event);
  }

  /**
   * Determines whether an event
   * currently has listeners.
   *
   * @param event Event identifier.
   *
   * @returns True if listeners exist.
   */
  public static has(
    event: string,
  ): boolean {
    return EventListener.has(event);
  }
}

export default EventManager;