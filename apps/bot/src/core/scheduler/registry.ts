/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized scheduler registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Scheduler task definition.
 */
export interface SchedulerDefinition {
  /**
   * Unique scheduler identifier.
   */
  readonly id: string;

  /**
   * Scheduler name.
   */
  readonly name: string;

  /**
   * Task description.
   */
  readonly description: string;

  /**
   * Cron expression.
   */
  readonly schedule: string;

  /**
   * Indicates whether the task is enabled.
   */
  readonly enabled: boolean;
}

/**
 * Centralized scheduler registry.
 */
export class SchedulerRegistry {
  /**
   * Registered scheduler tasks.
   */
  private static readonly schedulers = new Map<
    string,
    SchedulerDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a scheduler task.
   *
   * @param scheduler Scheduler definition.
   */
  public static register(
    scheduler: SchedulerDefinition,
  ): void {
    if (
      SchedulerRegistry.schedulers.has(
        scheduler.id,
      )
    ) {
      throw new ConfigurationError(
        `Scheduler "${scheduler.id}" is already registered.`,
      );
    }

    SchedulerRegistry.schedulers.set(
      scheduler.id,
      scheduler,
    );
  }

  /**
   * Resolves a scheduler task.
   *
   * @param id Scheduler identifier.
   *
   * @returns Registered scheduler.
   */
  public static resolve(
    id: string,
  ): SchedulerDefinition {
    const scheduler =
      SchedulerRegistry.schedulers.get(id);

    if (!scheduler) {
      throw new ConfigurationError(
        `Scheduler "${id}" is not registered.`,
      );
    }

    return scheduler;
  }

  /**
   * Determines whether a scheduler exists.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return SchedulerRegistry.schedulers.has(id);
  }

  /**
   * Returns every registered scheduler.
   *
   * @returns Registered schedulers.
   */
  public static getAll(): readonly SchedulerDefinition[] {
    return Object.freeze([
      ...SchedulerRegistry.schedulers.values(),
    ]);
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
    return SchedulerRegistry.schedulers.delete(
      id,
    );
  }

  /**
   * Clears every registered scheduler.
   */
  public static clear(): void {
    SchedulerRegistry.schedulers.clear();
  }
}

export default SchedulerRegistry;