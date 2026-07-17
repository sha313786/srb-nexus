/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Scheduler registration service.
 * =========================================================
 */

import {
  SchedulerDefinition,
  SchedulerRegistry,
} from "./registry.js";

/**
 * Scheduler registration service.
 */
export class SchedulerRegistration {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a scheduler.
   *
   * @param scheduler Scheduler definition.
   *
   * @returns Registered scheduler.
   */
  public static register(
    scheduler: SchedulerDefinition,
  ): SchedulerDefinition {
    SchedulerRegistry.register(scheduler);

    return scheduler;
  }

  /**
   * Registers multiple schedulers.
   *
   * @param schedulers Scheduler definitions.
   *
   * @returns Registered schedulers.
   */
  public static registerMany(
    schedulers: readonly SchedulerDefinition[],
  ): readonly SchedulerDefinition[] {
    for (const scheduler of schedulers) {
      SchedulerRegistry.register(scheduler);
    }

    return Object.freeze([...schedulers]);
  }

  /**
   * Removes a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if removed.
   */
  public static unregister(
    id: string,
  ): boolean {
    return SchedulerRegistry.remove(id);
  }

  /**
   * Clears every registered scheduler.
   */
  public static clear(): void {
    SchedulerRegistry.clear();
  }
}

export default SchedulerRegistration;