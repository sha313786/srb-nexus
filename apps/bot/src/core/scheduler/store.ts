/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : store.ts
 * Purpose : Scheduler runtime storage.
 * =========================================================
 */

import { SchedulerDefinition } from "./registry.js";

/**
 * Scheduler runtime store.
 */
export class SchedulerStore {
  /**
   * Runtime scheduler storage.
   */
  private static readonly store =
    new Map<string, SchedulerDefinition>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Stores a scheduler.
   *
   * @param scheduler Scheduler definition.
   */
  public static set(
    scheduler: SchedulerDefinition,
  ): void {
    SchedulerStore.store.set(
      scheduler.id,
      scheduler,
    );
  }

  /**
   * Stores multiple schedulers.
   *
   * @param schedulers Scheduler definitions.
   */
  public static setMany(
    schedulers: readonly SchedulerDefinition[],
  ): void {
    for (const scheduler of schedulers) {
      SchedulerStore.set(scheduler);
    }
  }

  /**
   * Retrieves a stored scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns Scheduler definition or undefined.
   */
  public static get(
    id: string,
  ): SchedulerDefinition | undefined {
    return SchedulerStore.store.get(id);
  }

  /**
   * Determines whether a scheduler exists.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if stored.
   */
  public static has(
    id: string,
  ): boolean {
    return SchedulerStore.store.has(id);
  }

  /**
   * Removes a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return SchedulerStore.store.delete(id);
  }

  /**
   * Returns every stored scheduler.
   *
   * @returns Stored schedulers.
   */
  public static getAll(): readonly SchedulerDefinition[] {
    return Object.freeze([
      ...SchedulerStore.store.values(),
    ]);
  }

  /**
   * Returns the total stored schedulers.
   *
   * @returns Scheduler count.
   */
  public static size(): number {
    return SchedulerStore.store.size;
  }

  /**
   * Clears the runtime store.
   */
  public static clear(): void {
    SchedulerStore.store.clear();
  }
}

export default SchedulerStore;