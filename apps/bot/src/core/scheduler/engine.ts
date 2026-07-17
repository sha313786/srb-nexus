/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : engine.ts
 * Purpose : Scheduler execution engine.
 * =========================================================
 */

import { SchedulerContextFactory } from "./context.js";
import { SchedulerLoader } from "./loader.js";
import { SchedulerDefinition } from "./registry.js";

/**
 * Scheduler execution result.
 */
export interface SchedulerExecutionResult {
  /**
   * Scheduler identifier.
   */
  readonly schedulerId: string;

  /**
   * Execution timestamp.
   */
  readonly executedAt: Date;

  /**
   * Execution status.
   */
  readonly success: boolean;

  /**
   * Optional execution error.
   */
  readonly error?: Error;
}

/**
 * Scheduler execution engine.
 */
export class SchedulerEngine {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a scheduler.
   *
   * @param scheduler Scheduler definition.
   *
   * @returns Execution result.
   */
  public static async execute(
    scheduler: SchedulerDefinition,
  ): Promise<SchedulerExecutionResult> {
    try {
      SchedulerContextFactory.create(scheduler);

      return Object.freeze({
        schedulerId: scheduler.id,
        executedAt: new Date(),
        success: true,
      });
    } catch (error) {
      return Object.freeze({
        schedulerId: scheduler.id,
        executedAt: new Date(),
        success: false,
        error:
          error instanceof Error
            ? error
            : new Error(String(error)),
      });
    }
  }

  /**
   * Executes a loaded scheduler.
   *
   * @param id Scheduler identifier.
   *
   * @returns Execution result.
   */
  public static async executeById(
    id: string,
  ): Promise<SchedulerExecutionResult> {
    const scheduler =
      SchedulerLoader
        .getLoaded()
        .find((item) => item.id === id);

    if (!scheduler) {
      throw new Error(
        `Scheduler "${id}" is not loaded.`,
      );
    }

    return SchedulerEngine.execute(
      scheduler,
    );
  }

  /**
   * Executes every loaded scheduler.
   *
   * @returns Execution results.
   */
  public static async executeAll(): Promise<
    readonly SchedulerExecutionResult[]
  > {
    const results: SchedulerExecutionResult[] =
      [];

    for (const scheduler of SchedulerLoader.getLoaded()) {
      results.push(
        await SchedulerEngine.execute(
          scheduler,
        ),
      );
    }

    return Object.freeze(results);
  }
}

export default SchedulerEngine;