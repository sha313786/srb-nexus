/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Module validation utilities.
 * =========================================================
 */

import { ModuleRegistry } from "./registry.js";

/**
 * Provides validation helpers for registered modules.
 */
export class ModuleValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Determines whether a module exists.
   *
   * @param id Module identifier.
   *
   * @returns True if the module exists.
   */
  public static validate(
    id: string,
  ): boolean {
    return ModuleRegistry.has(id);
  }

  /**
   * Determines whether every supplied module exists.
   *
   * @param ids Module identifiers.
   *
   * @returns True if every module exists.
   */
  public static validateAll(
    ...ids: readonly string[]
  ): boolean {
    return ids.every((id) =>
      ModuleRegistry.has(id),
    );
  }

  /**
   * Returns all missing modules.
   *
   * @param ids Module identifiers.
   *
   * @returns Missing module identifiers.
   */
  public static getMissing(
    ...ids: readonly string[]
  ): string[] {
    return ids.filter(
      (id) => !ModuleRegistry.has(id),
    );
  }
}

export default ModuleValidation;