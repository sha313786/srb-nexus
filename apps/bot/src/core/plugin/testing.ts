/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Plugin framework testing utilities.
 * =========================================================
 */

import { PluginRegistry } from "./registry.js";
import { PluginLoader } from "./loader.js";
import { PluginLifecycleManager } from "./lifecycle.js";
import { PluginRecoveryManager } from "./recovery.js";
import { PluginHealth } from "./health.js";

/**
 * Plugin framework test report.
 */
export interface PluginFrameworkReport {
  /**
   * Total registered plugins.
   */
  readonly registeredPlugins: number;

  /**
   * Total loaded plugins.
   */
  readonly loadedPlugins: number;

  /**
   * Lifecycle entries.
   */
  readonly lifecycleEntries: number;

  /**
   * Failed plugin operations.
   */
  readonly failedPlugins: number;

  /**
   * Overall framework health.
   */
  readonly healthy: boolean;
}

/**
 * Plugin framework testing utilities.
 */
export class PluginTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a framework self-test.
   *
   * @returns Framework report.
   */
  public static selfTest(): Readonly<PluginFrameworkReport> {
    return Object.freeze({
      registeredPlugins: PluginRegistry.getAll().length,
      loadedPlugins: PluginLoader.getLoaded().length,
      lifecycleEntries: PluginLifecycleManager.getAll().length,
      failedPlugins: PluginRecoveryManager.count(),
      healthy: PluginHealth.isHealthy(),
    });
  }

  /**
   * Clears runtime testing artifacts.
   */
  public static reset(): void {
    PluginLoader.clear();
    PluginLifecycleManager.clear();
    PluginRecoveryManager.clear();
  }
}

export default PluginTesting;