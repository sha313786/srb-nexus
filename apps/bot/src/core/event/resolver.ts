/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized event resolver.
 * =========================================================
 */

import {
  EventRegistry,
  type EventDefinition,
} from "./registry.js";

/**
 * Provides read-only access to registered events.
 */
export class EventResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves an event.
   *
   * @param id Event identifier.
   *
   * @returns Registered event.
   */
  public static resolve(
    id: string,
  ): EventDefinition {
    return EventRegistry.resolve(id);
  }

  /**
   * Determines whether an event exists.
   *
   * @param id Event identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return EventRegistry.has(id);
  }

  /**
   * Returns all registered events.
   *
   * @returns Registered events.
   */
  public static getAll(): readonly EventDefinition[] {
    return EventRegistry.getAll();
  }
}

export default EventResolver;