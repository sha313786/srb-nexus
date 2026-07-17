/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Scheduler framework testing utilities.
 * =========================================================
 */

import { SchedulerRegistry } from "./registry.js";
import { SchedulerLoader } from "./loader.js";
import { SchedulerStore } from "./store.js";
import { SchedulerQueue } from "./queue.js";
import { SchedulerWorker } from "./worker.js";
import { SchedulerRecoveryManager } from "./recovery.js";
import { SchedulerHealth } from "./health.js";

/**
 * Scheduler framework test report.
 */
export interface SchedulerFrameworkReport {
  /**
   * Registered schedulers.
   */
  readonly registeredSchedulers: number;

  /**
   * Loaded schedulers.
   */
  readonly loadedSchedulers: number;

  /**
   * Stored schedulers.
   */
  readonly storedSchedulers: number;

  /**
   * Pending schedulers.
   */
  readonly queuedSchedulers: number;

  /**
   * Active workers.
   */
  readonly activeWorkers: number;

  /**
   * Failed schedulers.
   */
  readonly failedSchedulers: number;

  /**
   * Overall framework health.
   */
  readonly healthy: boolean;
}

/**
 * Scheduler framework testing utilities.
 */
export class SchedulerTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a scheduler framework self-test.
   *
   * @returns Framework report.
   */
  public static selfTest(): Readonly<SchedulerFrameworkReport> {
    return Object.freeze({
      registeredSchedulers:
        SchedulerRegistry.getAll().length,

      loadedSchedulers:
        SchedulerLoader.getLoaded().length,

      storedSchedulers:
        SchedulerStore.getAll().length,

      queuedSchedulers:
        SchedulerQueue.size(),

      activeWorkers:
        SchedulerWorker.count(),

      failedSchedulers:
        SchedulerRecoveryManager.count(),

      healthy:
        SchedulerHealth.isHealthy(),
    });
  }

  /**
   * Clears runtime testing artifacts.
   */
  public static reset(): void {
    SchedulerLoader.clear();
    SchedulerStore.clear();
    SchedulerQueue.clear();
    SchedulerWorker.clear();
    SchedulerRecoveryManager.clear();
  }
}

export default SchedulerTesting;