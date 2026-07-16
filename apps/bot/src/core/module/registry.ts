/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized module registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Represents a registered application module.
 */
export interface ModuleDefinition {
  /**
   * Unique module identifier.
   */
  readonly id: string;

  /**
   * Human-readable module name.
   */
  readonly name: string;

  /**
   * Module version.
   */
  readonly version: string;
}

/**
 * Centralized module registry.
 *
 * Responsible for tracking every framework module.
 */
export class ModuleRegistry {
  /**
   * Registered modules.
   */
  private static readonly modules = new Map<
    string,
    ModuleDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a module.
   *
   * @param module Module definition.
   */
  public static register(
    module: ModuleDefinition,
  ): void {
    if (ModuleRegistry.modules.has(module.id)) {
      throw new ConfigurationError(
        `Module "${module.id}" is already registered.`,
      );
    }

    ModuleRegistry.modules.set(module.id, module);
  }

  /**
   * Returns a module.
   *
   * @param id Module identifier.
   */
  public static resolve(
    id: string,
  ): ModuleDefinition {
    const module = ModuleRegistry.modules.get(id);

    if (!module) {
      throw new ConfigurationError(
        `Module "${id}" is not registered.`,
      );
    }

    return module;
  }

  /**
   * Determines whether a module exists.
   */
  public static has(
    id: string,
  ): boolean {
    return ModuleRegistry.modules.has(id);
  }

  /**
   * Removes a module.
   */
  public static remove(
    id: string,
  ): boolean {
    return ModuleRegistry.modules.delete(id);
  }

  /**
   * Returns all registered modules.
   */
  public static getAll(): readonly ModuleDefinition[] {
    return Object.freeze(
      [...ModuleRegistry.modules.values()],
    );
  }

  /**
   * Clears the registry.
   */
  public static clear(): void {
    ModuleRegistry.modules.clear();
  }
}

export default ModuleRegistry;