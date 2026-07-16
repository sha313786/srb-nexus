/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : load-order.ts
 * Purpose : Plugin load order manager.
 * =========================================================
 */

import { PluginDependencyManager } from "./dependency.js";
import { PluginRegistry } from "./registry.js";

/**
 * Centralized plugin load order manager.
 */
export class PluginLoadOrderManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the recommended plugin load order.
   *
   * Plugins are ordered so that dependencies
   * are loaded before dependents.
   *
   * @returns Ordered plugin identifiers.
   */
  public static resolve(): readonly string[] {
    const resolved: string[] = [];
    const visited = new Set<string>();

    const visit = (plugin: string): void => {
      if (visited.has(plugin)) {
        return;
      }

      visited.add(plugin);

      for (const dependency of PluginDependencyManager.get(plugin)) {
        visit(dependency);
      }

      resolved.push(plugin);
    };

    for (const plugin of PluginRegistry.getAll()) {
      visit(plugin.id);
    }

    return Object.freeze(resolved);
  }

  /**
   * Returns whether every plugin dependency
   * can be resolved.
   *
   * @returns True if the load order is valid.
   */
  public static validate(): boolean {
    return PluginRegistry
      .getAll()
      .every((plugin) =>
        PluginDependencyManager.validate(plugin.id),
      );
  }
}

export default PluginLoadOrderManager;