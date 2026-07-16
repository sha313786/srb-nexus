/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : listener.ts
 * Purpose : Centralized event listener.
 * =========================================================
 */

import {
  EventDispatcher,
  type EventHandler,
} from "./dispatcher.js";

/**
 * Centralized event listener.
 *
 * Provides a unified interface for subscribing
 * and unsubscribing from framework events.
 */
export class EventListener {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Subscribes to an event.
   *
   * @param event Event name.
   * @param handler Event handler.
   */
  public static subscribe<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    EventDispatcher.on(event, handler);
  }

  /**
   * Unsubscribes from an event.
   *
   * @param event Event name.
   * @param handler Event handler.
   */
  public static unsubscribe<T>(
    event: string,
    handler: EventHandler<T>,
  ): void {
    EventDispatcher.off(event, handler);
  }

  /**
   * Determines whether an event has listeners.
   *
   * @param event Event name.
   *
   * @returns True if listeners exist.
   */
  public static has(
    event: string,
  ): boolean {
    return EventDispatcher.has(event);
  }
}

export default EventListener;