/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized plugin resolver.
 * =========================================================
 */

import {
  PluginRegistry,
  type PluginDefinition,
} from "./registry.js";

/**
 * Provides read-only access to registered plugins.
 */
export class PluginResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

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
    return PluginRegistry.resolve(id);
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
    return PluginRegistry.has(id);
  }

  /**
   * Returns every registered plugin.
   *
   * @returns Registered plugins.
   */
  public static getAll(): readonly PluginDefinition[] {
    return PluginRegistry.getAll();
  }
}

export default PluginResolver;