/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitor.ts
 * Purpose : Command monitoring utilities.
 * =========================================================
 */

import { CommandMetricsManager } from "./metrics.js";

/**
 * Command monitoring utilities.
 */
export class CommandMonitor {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the total number of monitored commands.
   *
   * @returns Command count.
   */
  public static totalCommands(): number {
    return CommandMetricsManager.getAll().length;
  }

  /**
   * Returns the total number of command executions.
   *
   * @returns Execution count.
   */
  public static totalExecutions(): number {
    return CommandMetricsManager.getAll().reduce(
      (total, metric) => total + metric.executions,
      0,
    );
  }

  /**
   * Determines whether a command has executed.
   *
   * @param command Command identifier.
   *
   * @returns True if executed.
   */
  public static hasExecuted(
    command: string,
  ): boolean {
    return (
      CommandMetricsManager.get(command) !== undefined
    );
  }

  /**
   * Resets monitoring statistics.
   */
  public static reset(): void {
    CommandMetricsManager.clear();
  }
}

export default CommandMonitor;
