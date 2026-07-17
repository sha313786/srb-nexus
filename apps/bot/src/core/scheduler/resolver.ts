/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Scheduler resolution service.
 * =========================================================
 */

import {
  SchedulerDefinition,
  SchedulerRegistry,
} from "./registry.js";

/**
 * Scheduler resolution service.
 */
export class SchedulerResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a scheduler by identifier.
   *
   * @param id Scheduler identifier.
   *
   * @returns Scheduler definition.
   */
  public static resolve(
    id: string,
  ): SchedulerDefinition {
    return SchedulerRegistry.resolve(id);
  }

  /**
   * Attempts to resolve a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns Scheduler definition or undefined.
   */
  public static tryResolve(
    id: string,
  ): SchedulerDefinition | undefined {
    if (!SchedulerRegistry.has(id)) {
      return undefined;
    }

    return SchedulerRegistry.resolve(id);
  }

  /**
   * Determines whether a scheduler exists.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if the scheduler exists.
   */
  public static exists(
    id: string,
  ): boolean {
    return SchedulerRegistry.has(id);
  }

  /**
   * Resolves all registered schedulers.
   *
   * @returns Registered schedulers.
   */
  public static resolveAll(): readonly SchedulerDefinition[] {
    return SchedulerRegistry.getAll();
  }
}

export default SchedulerResolver;