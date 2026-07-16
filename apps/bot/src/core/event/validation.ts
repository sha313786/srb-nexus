/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Event validation utilities.
 * =========================================================
 */

import { EventRegistry } from "./registry.js";

/**
 * Provides validation helpers for registered events.
 */
export class EventValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Determines whether an event exists.
   *
   * @param id Event identifier.
   *
   * @returns True if the event exists.
   */
  public static validate(
    id: string,
  ): boolean {
    return EventRegistry.has(id);
  }

  /**
   * Determines whether every supplied event exists.
   *
   * @param ids Event identifiers.
   *
   * @returns True if every event exists.
   */
  public static validateAll(
    ...ids: readonly string[]
  ): boolean {
    return ids.every((id) =>
      EventRegistry.has(id),
    );
  }

  /**
   * Returns all missing events.
   *
   * @param ids Event identifiers.
   *
   * @returns Missing event identifiers.
   */
  public static getMissing(
    ...ids: readonly string[]
  ): string[] {
    return ids.filter(
      (id) => !EventRegistry.has(id),
    );
  }
}

export default EventValidation;