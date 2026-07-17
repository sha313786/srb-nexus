/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Scheduler lifecycle manager.
 * =========================================================
 */

import {
  SchedulerDefinition,
  SchedulerRegistry,
} from "./registry.js";
import { SchedulerLoader } from "./loader.js";

/**
 * Scheduler lifecycle manager.
 */
export class SchedulerManager {
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
    return SchedulerLoader.load(id);
  }

  /**
   * Loads every registered scheduler.
   *
   * @returns Loaded schedulers.
   */
  public static loadAll(): readonly SchedulerDefinition[] {
    return SchedulerLoader.loadAll();
  }

  /**
   * Reloads a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns Reloaded scheduler.
   */
  public static reload(
    id: string,
  ): SchedulerDefinition {
    SchedulerLoader.unload(id);

    return SchedulerLoader.load(id);
  }

  /**
   * Reloads every scheduler.
   *
   * @returns Reloaded schedulers.
   */
  public static reloadAll(): readonly SchedulerDefinition[] {
    SchedulerLoader.clear();

    return SchedulerLoader.loadAll();
  }

  /**
   * Stops a scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if stopped.
   */
  public static stop(
    id: string,
  ): boolean {
    return SchedulerLoader.unload(id);
  }

  /**
   * Stops every scheduler.
   */
  public static stopAll(): void {
    SchedulerLoader.clear();
  }

  /**
   * Returns every active scheduler.
   *
   * @returns Active schedulers.
   */
  public static active(): readonly SchedulerDefinition[] {
    return SchedulerLoader.getLoaded();
  }

  /**
   * Returns every registered scheduler.
   *
   * @returns Registered schedulers.
   */
  public static registered(): readonly SchedulerDefinition[] {
    return SchedulerRegistry.getAll();
  }
}

export default SchedulerManager;