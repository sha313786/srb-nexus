/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : metrics.ts
 * Purpose : Event metrics collection.
 * =========================================================
 */

/**
 * Represents event execution statistics.
 */
export interface EventMetrics {
  /**
   * Event identifier.
   */
  readonly event: string;

  /**
   * Total execution count.
   */
  executions: number;

  /**
   * Last execution timestamp.
   */
  lastExecuted?: Date;
}

/**
 * Centralized event metrics manager.
 */
export class EventMetricsManager {
  /**
   * Event metrics storage.
   */
  private static readonly metrics = new Map<
    string,
    EventMetrics
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records an event execution.
   *
   * @param event Event identifier.
   */
  public static record(
    event: string,
  ): void {
    const metric =
      EventMetricsManager.metrics.get(event);

    if (metric) {
      metric.executions++;
      metric.lastExecuted = new Date();
      return;
    }

    EventMetricsManager.metrics.set(event, {
      event,
      executions: 1,
      lastExecuted: new Date(),
    });
  }

  /**
   * Returns metrics for an event.
   *
   * @param event Event identifier.
   *
   * @returns Event metrics.
   */
  public static get(
    event: string,
  ): EventMetrics | undefined {
    return EventMetricsManager.metrics.get(event);
  }

  /**
   * Returns every collected metric.
   *
   * @returns Metrics.
   */
  public static getAll(): readonly EventMetrics[] {
    return Object.freeze([
      ...EventMetricsManager.metrics.values(),
    ]);
  }

  /**
   * Clears all metrics.
   */
  public static clear(): void {
    EventMetricsManager.metrics.clear();
  }
}

export default EventMetricsManager;