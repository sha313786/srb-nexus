/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized plugin registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Plugin definition.
 */
export interface PluginDefinition {
  /**
   * Unique plugin identifier.
   */
  readonly id: string;

  /**
   * Plugin name.
   */
  readonly name: string;

  /**
   * Plugin version.
   */
  readonly version: string;

  /**
   * Plugin description.
   */
  readonly description: string;

  /**
   * Plugin author.
   */
  readonly author: string;
}

/**
 * Centralized plugin registry.
 */
export class PluginRegistry {
  /**
   * Registered plugins.
   */
  private static readonly plugins = new Map<
    string,
    PluginDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a plugin.
   *
   * @param plugin Plugin definition.
   */
  public static register(
    plugin: PluginDefinition,
  ): void {
    if (PluginRegistry.plugins.has(plugin.id)) {
      throw new ConfigurationError(
        `Plugin "${plugin.id}" is already registered.`,
      );
    }

    PluginRegistry.plugins.set(
      plugin.id,
      plugin,
    );
  }

  /**
   * Resolves a plugin.
   *
   * @param id Plugin identifier.
   *
   * @returns Registered plugin.
   */
  public static resolve(
    id: string,
  ): PluginDefinition {
    const plugin =
      PluginRegistry.plugins.get(id);

    if (!plugin) {
      throw new ConfigurationError(
        `Plugin "${id}" is not registered.`,
      );
    }

    return plugin;
  }

  /**
   * Determines whether a plugin exists.
   *
   * @param id Plugin identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return PluginRegistry.plugins.has(id);
  }

  /**
   * Returns every registered plugin.
   *
   * @returns Registered plugins.
   */
  public static getAll(): readonly PluginDefinition[] {
    return Object.freeze([
      ...PluginRegistry.plugins.values(),
    ]);
  }

  /**
   * Removes a plugin.
   *
   * @param id Plugin identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return PluginRegistry.plugins.delete(id);
  }

  /**
   * Clears every registered plugin.
   */
  public static clear(): void {
    PluginRegistry.plugins.clear();
  }
}

export default PluginRegistry;