/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Event framework testing utilities.
 * =========================================================
 */

import { EventDispatcher } from "./dispatcher.js";
import { EventRegistry } from "./registry.js";
import { EventMetricsManager } from "./metrics.js";
import { EventRecoveryManager } from "./recovery.js";
import { AsyncEventQueue } from "./queue.js";

/**
 * Event framework health report.
 */
export interface EventFrameworkReport {
  /**
   * Registered events.
   */
  readonly registeredEvents: number;

  /**
   * Events with metrics.
   */
  readonly monitoredEvents: number;

  /**
   * Pending queued events.
   */
  readonly queuedEvents: number;

  /**
   * Failed events.
   */
  readonly failedEvents: number;

  /**
   * Dispatcher status.
   */
  readonly dispatcherReady: boolean;
}

/**
 * Framework testing utilities.
 */
export class EventTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a framework self-test.
   *
   * @returns Framework report.
   */
  public static selfTest(): Readonly<EventFrameworkReport> {
    return Object.freeze({
      registeredEvents: EventRegistry.getAll().length,
      monitoredEvents: EventMetricsManager.getAll().length,
      queuedEvents: AsyncEventQueue.size(),
      failedEvents: EventRecoveryManager.count(),
      dispatcherReady: true,
    });
  }

  /**
   * Clears every runtime testing artifact.
   */
  public static reset(): void {
    EventDispatcher.clear();
    EventMetricsManager.clear();
    EventRecoveryManager.clear();
    AsyncEventQueue.clear();
  }
}

export default EventTesting;