/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Plugin validation utilities.
 * =========================================================
 */

import { PluginRegistry } from "./registry.js";

/**
 * Provides validation helpers for registered plugins.
 */
export class PluginValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Determines whether a plugin exists.
   *
   * @param id Plugin identifier.
   *
   * @returns True if the plugin exists.
   */
  public static validate(
    id: string,
  ): boolean {
    return PluginRegistry.has(id);
  }

  /**
   * Determines whether every supplied plugin exists.
   *
   * @param ids Plugin identifiers.
   *
   * @returns True if every plugin exists.
   */
  public static validateAll(
    ...ids: readonly string[]
  ): boolean {
    return ids.every((id) =>
      PluginRegistry.has(id),
    );
  }

  /**
   * Returns all missing plugins.
   *
   * @param ids Plugin identifiers.
   *
   * @returns Missing plugin identifiers.
   */
  public static getMissing(
    ...ids: readonly string[]
  ): string[] {
    return ids.filter(
      (id) => !PluginRegistry.has(id),
    );
  }
}

export default PluginValidation;