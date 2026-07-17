/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : loader.ts
 * Purpose : Scheduler loading framework.
 * =========================================================
 */

import {
  SchedulerDefinition,
  SchedulerRegistry,
} from "./registry.js";

/**
 * Scheduler loader.
 */
export class SchedulerLoader {
  /**
   * Loaded schedulers.
   */
  private static readonly loaded =
    new Map<string, SchedulerDefinition>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns Loaded scheduler.
   */
  public static load(
    id: string,
  ): SchedulerDefinition {
    const scheduler =
      SchedulerRegistry.resolve(id);

    SchedulerLoader.loaded.set(
      id,
      scheduler,
    );

    return scheduler;
  }

  /**
   * Loads every registered scheduler.
   *
   * @returns Loaded schedulers.
   */
  public static loadAll(): readonly SchedulerDefinition[] {
    const loaded: SchedulerDefinition[] = [];

    for (const scheduler of SchedulerRegistry.getAll()) {
      SchedulerLoader.loaded.set(
        scheduler.id,
        scheduler,
      );

      loaded.push(scheduler);
    }

    return Object.freeze(loaded);
  }

  /**
   * Determines whether a scheduler is loaded.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if loaded.
   */
  public static isLoaded(
    id: string,
  ): boolean {
    return SchedulerLoader.loaded.has(id);
  }

  /**
   * Returns every loaded scheduler.
   *
   * @returns Loaded schedulers.
   */
  public static getLoaded(): readonly SchedulerDefinition[] {
    return Object.freeze([
      ...SchedulerLoader.loaded.values(),
    ]);
  }

  /**
   * Unloads a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if unloaded.
   */
  public static unload(
    id: string,
  ): boolean {
    return SchedulerLoader.loaded.delete(id);
  }

  /**
   * Clears every loaded scheduler.
   */
  public static clear(): void {
    SchedulerLoader.loaded.clear();
  }
}

export default SchedulerLoader;