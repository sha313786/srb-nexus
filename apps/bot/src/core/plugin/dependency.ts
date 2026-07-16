/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : dependency.ts
 * Purpose : Plugin dependency resolution.
 * =========================================================
 */

import { PluginRegistry } from "./registry.js";

/**
 * Plugin dependency information.
 */
export interface PluginDependency {
  /**
   * Plugin identifier.
   */
  readonly plugin: string;

  /**
   * Required plugin identifiers.
   */
  readonly requires: readonly string[];
}

/**
 * Centralized plugin dependency manager.
 */
export class PluginDependencyManager {
  /**
   * Dependency storage.
   */
  private static readonly dependencies = new Map<
    string,
    readonly string[]
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers plugin dependencies.
   *
   * @param plugin Plugin identifier.
   * @param requires Required plugins.
   */
  public static register(
    plugin: string,
    requires: readonly string[],
  ): void {
    PluginDependencyManager.dependencies.set(
      plugin,
      [...requires],
    );
  }

  /**
   * Returns plugin dependencies.
   *
   * @param plugin Plugin identifier.
   *
   * @returns Required plugins.
   */
  public static get(
    plugin: string,
  ): readonly string[] {
    return (
      PluginDependencyManager.dependencies.get(
        plugin,
      ) ?? []
    );
  }

  /**
   * Determines whether every dependency exists.
   *
   * @param plugin Plugin identifier.
   *
   * @returns True if dependencies are satisfied.
   */
  public static validate(
    plugin: string,
  ): boolean {
    return PluginDependencyManager
      .get(plugin)
      .every((dependency) =>
        PluginRegistry.has(dependency),
      );
  }

  /**
   * Returns missing dependencies.
   *
   * @param plugin Plugin identifier.
   *
   * @returns Missing plugin identifiers.
   */
  public static getMissing(
    plugin: string,
  ): readonly string[] {
    return PluginDependencyManager
      .get(plugin)
      .filter(
        (dependency) =>
          !PluginRegistry.has(dependency),
      );
  }

  /**
   * Clears every registered dependency.
   */
  public static clear(): void {
    PluginDependencyManager.dependencies.clear();
  }
}

export default PluginDependencyManager;