/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : health.ts
 * Purpose : Plugin framework health service.
 * =========================================================
 */

import { PluginRegistry } from "./registry.js";
import { PluginLoader } from "./loader.js";
import { PluginLifecycleManager } from "./lifecycle.js";
import { PluginDependencyManager } from "./dependency.js";

/**
 * Represents the overall plugin framework health.
 */
export interface PluginHealthReport {
  /**
   * Overall framework health.
   */
  readonly healthy: boolean;

  /**
   * Total registered plugins.
   */
  readonly registeredPlugins: number;

  /**
   * Total loaded plugins.
   */
  readonly loadedPlugins: number;

  /**
   * Plugins with valid dependencies.
   */
  readonly validDependencies: number;

  /**
   * Active lifecycle entries.
   */
  readonly lifecycleEntries: number;
}

/**
 * Plugin framework health service.
 */
export class PluginHealth {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Generates a plugin health report.
   *
   * @returns Health report.
   */
  public static report(): Readonly<PluginHealthReport> {
    const plugins = PluginRegistry.getAll();

    const registeredPlugins = plugins.length;

    const loadedPlugins =
      PluginLoader.getLoaded().length;

    const validDependencies = plugins.filter(
      (plugin) =>
        PluginDependencyManager.validate(
          plugin.id,
        ),
    ).length;

    const lifecycleEntries =
      PluginLifecycleManager.getAll().length;

    return Object.freeze({
      healthy:
        registeredPlugins >= loadedPlugins &&
        validDependencies === registeredPlugins,

      registeredPlugins,
      loadedPlugins,
      validDependencies,
      lifecycleEntries,
    });
  }

  /**
   * Determines whether the plugin framework
   * is healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return PluginHealth.report().healthy;
  }
}

export default PluginHealth;