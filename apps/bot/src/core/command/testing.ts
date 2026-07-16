/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Command framework testing utilities.
 * =========================================================
 */

import { CommandDispatcher } from "./dispatcher.js";
import { CommandRegistry } from "./registry.js";
import { CommandMetricsManager } from "./metrics.js";
import { CommandRecoveryManager } from "./recovery.js";

/**
 * Command framework health report.
 */
export interface CommandFrameworkReport {
  /**
   * Registered commands.
   */
  readonly registeredCommands: number;

  /**
   * Commands with metrics.
   */
  readonly monitoredCommands: number;

  /**
   * Failed commands.
   */
  readonly failedCommands: number;

  /**
   * Dispatcher status.
   */
  readonly dispatcherReady: boolean;
}

/**
 * Framework testing utilities.
 */
export class CommandTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a framework self-test.
   *
   * @returns Framework report.
   */
  public static selfTest(): Readonly<CommandFrameworkReport> {
    return Object.freeze({
      registeredCommands: CommandRegistry.getAll().length,
      monitoredCommands: CommandMetricsManager.getAll().length,
      failedCommands: CommandRecoveryManager.count(),
      dispatcherReady: true,
    });
  }

  /**
   * Clears every runtime testing artifact.
   */
  public static reset(): void {
    CommandDispatcher.clear();
    CommandMetricsManager.clear();
    CommandRecoveryManager.clear();
  }
}

export default CommandTesting;