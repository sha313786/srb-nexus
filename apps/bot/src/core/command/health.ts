/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : health.ts
 * Purpose : Command framework health service.
 * =========================================================
 */

import { CommandRegistry } from "./registry.js";
import { CommandDispatcher } from "./dispatcher.js";
import { CommandMetricsManager } from "./metrics.js";
import { CommandRecoveryManager } from "./recovery.js";

/**
 * Represents the overall command framework health.
 */
export interface CommandHealthReport {
  /**
   * Framework operational status.
   */
  readonly healthy: boolean;

  /**
   * Total registered commands.
   */
  readonly registeredCommands: number;

  /**
   * Total registered handlers.
   */
  readonly registeredHandlers: number;

  /**
   * Total monitored commands.
   */
  readonly monitoredCommands: number;

  /**
   * Pending failed commands.
   */
  readonly failedCommands: number;
}

/**
 * Command framework health service.
 */
export class CommandHealth {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Generates a health report.
   *
   * @returns Framework health report.
   */
  public static report(): Readonly<CommandHealthReport> {
    const registeredCommands =
      CommandRegistry.getAll().length;

    const monitoredCommands =
      CommandMetricsManager.getAll().length;

    const failedCommands =
      CommandRecoveryManager.count();

    const registeredHandlers =
      CommandRegistry
        .getAll()
        .filter(command =>
          CommandDispatcher.has(command.id),
        ).length;

    return Object.freeze({
      healthy: failedCommands === 0,
      registeredCommands,
      registeredHandlers,
      monitoredCommands,
      failedCommands,
    });
  }

  /**
   * Indicates whether the framework
   * is currently healthy.
   *
   * @returns Health status.
   */
  public static isHealthy(): boolean {
    return CommandHealth.report().healthy;
  }
}

export default CommandHealth;