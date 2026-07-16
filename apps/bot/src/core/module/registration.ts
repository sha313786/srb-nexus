/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default framework module registration.
 * =========================================================
 */

import {
  ModuleRegistry,
  type ModuleDefinition,
} from "./registry.js";

/**
 * Registers all built-in SRB NEXUS modules.
 *
 * Future milestones will extend this class with
 * framework modules such as:
 *
 * - Discord
 * - Dashboard
 * - API
 * - Database
 * - Scheduler
 * - AI
 */
export class ModuleRegistration {
  /**
   * Indicates whether registration has completed.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers the default framework modules.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (ModuleRegistration.registered) {
      return;
    }

    const modules: readonly ModuleDefinition[] = [
      {
        id: "core",
        name: "SRB NEXUS Core",
        version: "1.0.0",
      },
    ];

    for (const module of modules) {
      if (!ModuleRegistry.has(module.id)) {
        ModuleRegistry.register(module);
      }
    }

    ModuleRegistration.registered = true;
  }

  /**
   * Indicates whether registration has completed.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return ModuleRegistration.registered;
  }
}

export default ModuleRegistration;