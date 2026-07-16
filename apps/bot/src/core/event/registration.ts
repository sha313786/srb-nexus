/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default framework event registration.
 * =========================================================
 */

import {
  EventRegistry,
  type EventDefinition,
} from "./registry.js";

/**
 * Registers the default SRB NEXUS framework events.
 */
export class EventRegistration {
  /**
   * Indicates whether registration has completed.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers all built-in framework events.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (EventRegistration.registered) {
      return;
    }

    const events: readonly EventDefinition[] = [
      {
        id: "application.startup",
        name: "Application Startup",
        description: "Raised when the application startup pipeline completes.",
      },
      {
        id: "application.shutdown",
        name: "Application Shutdown",
        description: "Raised when the application shutdown pipeline begins.",
      },
    ];

    for (const event of events) {
      if (!EventRegistry.has(event.id)) {
        EventRegistry.register(event);
      }
    }

    EventRegistration.registered = true;
  }

  /**
   * Indicates whether registration has completed.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return EventRegistration.registered;
  }
}

export default EventRegistration;