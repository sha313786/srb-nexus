/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized event registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Event metadata.
 */
export interface EventDefinition {
  /**
   * Unique event identifier.
   */
  readonly id: string;

  /**
   * Human-readable event name.
   */
  readonly name: string;

  /**
   * Event description.
   */
  readonly description: string;
}

/**
 * Centralized event registry.
 *
 * Stores metadata for every framework event.
 */
export class EventRegistry {
  /**
   * Registered events.
   */
  private static readonly events = new Map<
    string,
    EventDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers an event.
   *
   * @param event Event definition.
   */
  public static register(
    event: EventDefinition,
  ): void {
    if (EventRegistry.events.has(event.id)) {
      throw new ConfigurationError(
        `Event "${event.id}" is already registered.`,
      );
    }

    EventRegistry.events.set(event.id, event);
  }

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
    const event = EventRegistry.events.get(id);

    if (!event) {
      throw new ConfigurationError(
        `Event "${id}" is not registered.`,
      );
    }

    return event;
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
    return EventRegistry.events.has(id);
  }

  /**
   * Returns every registered event.
   *
   * @returns Registered events.
   */
  public static getAll(): readonly EventDefinition[] {
    return Object.freeze([
      ...EventRegistry.events.values(),
    ]);
  }

  /**
   * Removes an event.
   *
   * @param id Event identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return EventRegistry.events.delete(id);
  }

  /**
   * Clears every registered event.
   */
  public static clear(): void {
    EventRegistry.events.clear();
  }
}

export default EventRegistry;