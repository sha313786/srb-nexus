/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : loader.ts
 * Purpose : Centralized plugin loader.
 * =========================================================
 */

import {
  PluginRegistry,
  type PluginDefinition,
} from "./registry.js";

/**
 * Plugin loading service.
 */
export class PluginLoader {
  /**
   * Loaded plugins.
   */
  private static readonly loaded = new Set<string>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a registered plugin.
   *
   * @param id Plugin identifier.
   *
   * @returns Loaded plugin.
   */
  public static load(
    id: string,
  ): PluginDefinition {
    const plugin =
      PluginRegistry.resolve(id);

    PluginLoader.loaded.add(id);

    return plugin;
  }

  /**
   * Unloads a plugin.
   *
   * @param id Plugin identifier.
   *
   * @returns True if unloaded.
   */
  public static unload(
    id: string,
  ): boolean {
    return PluginLoader.loaded.delete(id);
  }

  /**
   * Determines whether a plugin is loaded.
   *
   * @param id Plugin identifier.
   *
   * @returns True if loaded.
   */
  public static isLoaded(
    id: string,
  ): boolean {
    return PluginLoader.loaded.has(id);
  }

  /**
   * Returns every loaded plugin.
   *
   * @returns Loaded plugins.
   */
  public static getLoaded(): readonly PluginDefinition[] {
    return Object.freeze(
      PluginRegistry
        .getAll()
        .filter((plugin) =>
          PluginLoader.loaded.has(plugin.id),
        ),
    );
  }

  /**
   * Unloads every plugin.
   */
  public static clear(): void {
    PluginLoader.loaded.clear();
  }
}

export default PluginLoader;