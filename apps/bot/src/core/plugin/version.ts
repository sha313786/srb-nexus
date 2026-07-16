/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : version.ts
 * Purpose : Plugin version compatibility manager.
 * =========================================================
 */

import { PluginRegistry } from "./registry.js";

/**
 * Plugin version requirements.
 */
export interface PluginVersionRequirement {
  /**
   * Plugin identifier.
   */
  readonly plugin: string;

  /**
   * Required minimum version.
   */
  readonly minimumVersion: string;
}

/**
 * Centralized plugin version manager.
 */
export class PluginVersionManager {
  /**
   * Version requirements.
   */
  private static readonly requirements = new Map<
    string,
    string
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a minimum version requirement.
   *
   * @param plugin Plugin identifier.
   * @param minimumVersion Required minimum version.
   */
  public static register(
    plugin: string,
    minimumVersion: string,
  ): void {
    PluginVersionManager.requirements.set(
      plugin,
      minimumVersion,
    );
  }

  /**
   * Returns the registered minimum version.
   *
   * @param plugin Plugin identifier.
   *
   * @returns Minimum version.
   */
  public static get(
    plugin: string,
  ): string | undefined {
    return PluginVersionManager.requirements.get(
      plugin,
    );
  }

  /**
   * Determines whether the plugin satisfies
   * its registered minimum version.
   *
   * @param plugin Plugin identifier.
   *
   * @returns True if compatible.
   */
  public static validate(
    plugin: string,
  ): boolean {
    const definition =
      PluginRegistry.resolve(plugin);

    const minimum =
      PluginVersionManager.get(plugin);

    if (!minimum) {
      return true;
    }

    return (
      definition.version.localeCompare(
        minimum,
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      ) >= 0
    );
  }

  /**
   * Clears every registered version requirement.
   */
  public static clear(): void {
    PluginVersionManager.requirements.clear();
  }
}

export default PluginVersionManager;