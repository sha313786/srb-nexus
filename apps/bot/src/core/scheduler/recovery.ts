/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Scheduler recovery manager.
 * =========================================================
 */

import { SchedulerManager } from "./manager.js";

/**
 * Represents a failed scheduler execution.
 */
export interface FailedScheduler {
  /**
   * Scheduler identifier.
   */
  readonly schedulerId: string;

  /**
   * Failure timestamp.
   */
  readonly timestamp: Date;

  /**
   * Failure reason.
   */
  readonly error: Error;
}

/**
 * Scheduler recovery manager.
 */
export class SchedulerRecoveryManager {
  /**
   * Failed scheduler executions.
   */
  private static readonly failures: FailedScheduler[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a failed scheduler execution.
   *
   * @param schedulerId Scheduler identifier.
   * @param error Failure reason.
   */
  public static record(
    schedulerId: string,
    error: Error,
  ): void {
    SchedulerRecoveryManager.failures.push({
      schedulerId,
      timestamp: new Date(),
      error,
    });
  }

  /**
   * Retries every failed scheduler.
   */
  public static retryAll(): void {
    const failures = [
      ...SchedulerRecoveryManager.failures,
    ];

    SchedulerRecoveryManager.failures.length = 0;

    for (const failure of failures) {
      try {
        SchedulerManager.reload(
          failure.schedulerId,
        );
      } catch (error) {
        SchedulerRecoveryManager.record(
          failure.schedulerId,
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Returns every recorded failure.
   *
   * @returns Failed schedulers.
   */
  public static getAll():
    readonly FailedScheduler[] {
    return Object.freeze([
      ...SchedulerRecoveryManager.failures,
    ]);
  }

  /**
   * Returns the number of failures.
   *
   * @returns Failure count.
   */
  public static count(): number {
    return SchedulerRecoveryManager.failures.length;
  }

  /**
   * Clears every recorded failure.
   */
  public static clear(): void {
    SchedulerRecoveryManager.failures.length = 0;
  }
}

export default SchedulerRecoveryManager;