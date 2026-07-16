/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitor.ts
 * Purpose : Plugin monitoring utilities.
 * =========================================================
 */

import { PluginHealth } from "./health.js";
import { PluginLoader } from "./loader.js";
import { PluginRecoveryManager } from "./recovery.js";

/**
 * Plugin monitoring utilities.
 */
export class PluginMonitor {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the total number of loaded plugins.
   *
   * @returns Loaded plugin count.
   */
  public static loadedPlugins(): number {
    return PluginLoader.getLoaded().length;
  }

  /**
   * Returns the number of failed plugin operations.
   *
   * @returns Failure count.
   */
  public static failedPlugins(): number {
    return PluginRecoveryManager.count();
  }

  /**
   * Determines whether the plugin framework
   * is currently healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return PluginHealth.isHealthy();
  }

  /**
   * Returns a monitoring snapshot.
   *
   * @returns Monitoring information.
   */
  public static snapshot(): Readonly<{
    loadedPlugins: number;
    failedPlugins: number;
    healthy: boolean;
    timestamp: Date;
  }> {
    return Object.freeze({
      loadedPlugins: PluginMonitor.loadedPlugins(),
      failedPlugins: PluginMonitor.failedPlugins(),
      healthy: PluginMonitor.isHealthy(),
      timestamp: new Date(),
    });
  }
}

export default PluginMonitor;