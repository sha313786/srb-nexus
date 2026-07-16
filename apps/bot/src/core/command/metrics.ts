/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : metrics.ts
 * Purpose : Command metrics collection.
 * =========================================================
 */

/**
 * Represents command execution metrics.
 */
export interface CommandMetrics {
  /**
   * Command identifier.
   */
  readonly command: string;

  /**
   * Total executions.
   */
  executions: number;

  /**
   * Last execution timestamp.
   */
  lastExecuted?: Date;
}

/**
 * Centralized command metrics manager.
 */
export class CommandMetricsManager {
  /**
   * Metrics storage.
   */
  private static readonly metrics = new Map<
    string,
    CommandMetrics
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a command execution.
   *
   * @param command Command identifier.
   */
  public static record(
    command: string,
  ): void {
    const metric =
      CommandMetricsManager.metrics.get(command);

    if (metric) {
      metric.executions++;
      metric.lastExecuted = new Date();
      return;
    }

    CommandMetricsManager.metrics.set(command, {
      command,
      executions: 1,
      lastExecuted: new Date(),
    });
  }

  /**
   * Returns metrics for a command.
   *
   * @param command Command identifier.
   *
   * @returns Metrics.
   */
  public static get(
    command: string,
  ): CommandMetrics | undefined {
    return CommandMetricsManager.metrics.get(command);
  }

  /**
   * Returns every metric.
   *
   * @returns Metrics.
   */
  public static getAll(): readonly CommandMetrics[] {
    return Object.freeze([
      ...CommandMetricsManager.metrics.values(),
    ]);
  }

  /**
   * Clears all metrics.
   */
  public static clear(): void {
    CommandMetricsManager.metrics.clear();
  }
}

export default CommandMetricsManager;