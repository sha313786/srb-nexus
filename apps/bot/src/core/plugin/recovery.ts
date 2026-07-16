/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Plugin recovery manager.
 * =========================================================
 */

import { PluginManager } from "./manager.js";

/**
 * Represents a failed plugin operation.
 */
export interface FailedPlugin {
  /**
   * Plugin identifier.
   */
  readonly plugin: string;

  /**
   * Failure timestamp.
   */
  readonly timestamp: Date;

  /**
   * Failure reason.
   */
  readonly error: Error;
}

/**
 * Centralized plugin recovery manager.
 */
export class PluginRecoveryManager {
  /**
   * Failed plugin operations.
   */
  private static readonly failures: FailedPlugin[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a plugin failure.
   *
   * @param plugin Plugin identifier.
   * @param error Failure reason.
   */
  public static record(
    plugin: string,
    error: Error,
  ): void {
    PluginRecoveryManager.failures.push({
      plugin,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Retries every failed plugin load.
   */
  public static retryAll(): void {
    const failures = [
      ...PluginRecoveryManager.failures,
    ];

    PluginRecoveryManager.failures.length = 0;

    for (const failure of failures) {
      try {
        PluginManager.load(
          failure.plugin,
        );
      } catch (error) {
        PluginRecoveryManager.record(
          failure.plugin,
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Returns every failed plugin.
   *
   * @returns Failed plugins.
   */
  public static getAll(): readonly FailedPlugin[] {
    return Object.freeze([
      ...PluginRecoveryManager.failures,
    ]);
  }

  /**
   * Returns the number of failures.
   *
   * @returns Failure count.
   */
  public static count(): number {
    return PluginRecoveryManager.failures.length;
  }

  /**
   * Clears every recorded failure.
   */
  public static clear(): void {
    PluginRecoveryManager.failures.length = 0;
  }
}

export default PluginRecoveryManager;