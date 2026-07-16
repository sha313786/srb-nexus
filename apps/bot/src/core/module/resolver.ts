/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized module resolver.
 * =========================================================
 */

import {
  ModuleRegistry,
  type ModuleDefinition,
} from "./registry.js";

/**
 * Centralized module resolver.
 *
 * Provides read-only access to registered modules.
 * Module registration and removal remain the
 * responsibility of ModuleRegistry.
 */
export class ModuleResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a registered module.
   *
   * @param id Module identifier.
   *
   * @returns Registered module.
   */
  public static resolve(
    id: string,
  ): ModuleDefinition {
    return ModuleRegistry.resolve(id);
  }

  /**
   * Determines whether a module exists.
   *
   * @param id Module identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return ModuleRegistry.has(id);
  }

  /**
   * Returns every registered module.
   *
   * @returns Registered modules.
   */
  public static getAll(): readonly ModuleDefinition[] {
    return ModuleRegistry.getAll();
  }
}

export default ModuleResolver;