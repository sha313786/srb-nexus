/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitor.ts
 * Purpose : Event monitoring utilities.
 * =========================================================
 */

import { EventMetricsManager } from "./metrics.js";

/**
 * Event monitoring utilities.
 */
export class EventMonitor {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the total number of registered metrics.
   *
   * @returns Metric count.
   */
  public static totalEvents(): number {
    return EventMetricsManager.getAll().length;
  }

  /**
   * Returns the total execution count across every event.
   *
   * @returns Execution count.
   */
  public static totalExecutions(): number {
    return EventMetricsManager.getAll().reduce(
      (total, metric) => total + metric.executions,
      0,
    );
  }

  /**
   * Returns whether an event has been executed.
   *
   * @param event Event identifier.
   *
   * @returns True if executed.
   */
  public static hasExecuted(
    event: string,
  ): boolean {
    return EventMetricsManager.get(event) !== undefined;
  }

  /**
   * Clears monitoring statistics.
   */
  public static reset(): void {
    EventMetricsManager.clear();
  }
}

export default EventMonitor;