/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : worker.ts
 * Purpose : Scheduler worker implementation.
 * =========================================================
 */

import {
  SchedulerExecutionResult,
  SchedulerEngine,
} from "./engine.js";

import { SchedulerDefinition } from "./registry.js";

/**
 * Scheduler worker.
 */
export class SchedulerWorker {
  /**
   * Running scheduler workers.
   */
  private static readonly workers =
    new Map<string, Promise<SchedulerExecutionResult>>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a scheduler asynchronously.
   *
   * @param scheduler Scheduler definition.
   *
   * @returns Execution promise.
   */
  public static run(
    scheduler: SchedulerDefinition,
  ): Promise<SchedulerExecutionResult> {
    const execution =
      SchedulerEngine.execute(scheduler);

    SchedulerWorker.workers.set(
      scheduler.id,
      execution,
    );

    execution.finally(() => {
      SchedulerWorker.workers.delete(
        scheduler.id,
      );
    });

    return execution;
  }

  /**
   * Determines whether a scheduler
   * is currently executing.
   *
   * @param id Scheduler identifier.
   *
   * @returns True if running.
   */
  public static isRunning(
    id: string,
  ): boolean {
    return SchedulerWorker.workers.has(id);
  }

  /**
   * Returns all active scheduler IDs.
   *
   * @returns Active scheduler IDs.
   */
  public static active(): readonly string[] {
    return Object.freeze([
      ...SchedulerWorker.workers.keys(),
    ]);
  }

  /**
   * Returns the total number of
   * running scheduler workers.
   *
   * @returns Worker count.
   */
  public static count(): number {
    return SchedulerWorker.workers.size;
  }

  /**
   * Waits for every active worker
   * to complete.
   */
  public static async waitAll(): Promise<void> {
    await Promise.all(
      SchedulerWorker.workers.values(),
    );
  }

  /**
   * Clears worker state.
   */
  public static clear(): void {
    SchedulerWorker.workers.clear();
  }
}

export default SchedulerWorker;