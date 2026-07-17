/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : health.ts
 * Purpose : Scheduler framework health service.
 * =========================================================
 */

import { SchedulerRegistry } from "./registry.js";
import { SchedulerLoader } from "./loader.js";
import { SchedulerStore } from "./store.js";
import { SchedulerWorker } from "./worker.js";
import { SchedulerQueue } from "./queue.js";

/**
 * Scheduler framework health report.
 */
export interface SchedulerHealthReport {
  /**
   * Overall framework health.
   */
  readonly healthy: boolean;

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
   * Report timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Scheduler framework health service.
 */
export class SchedulerHealth {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Generates a health report.
   *
   * @returns Health report.
   */
  public static report(): Readonly<SchedulerHealthReport> {
    const registered =
      SchedulerRegistry.getAll().length;

    const loaded =
      SchedulerLoader.getLoaded().length;

    const stored =
      SchedulerStore.getAll().length;

    const queued =
      SchedulerQueue.size();

    const workers =
      SchedulerWorker.count();

    return Object.freeze({
      healthy:
        loaded <= registered &&
        stored <= registered,

      registeredSchedulers: registered,
      loadedSchedulers: loaded,
      storedSchedulers: stored,
      queuedSchedulers: queued,
      activeWorkers: workers,
      timestamp: new Date(),
    });
  }

  /**
   * Determines whether the scheduler
   * framework is healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return SchedulerHealth.report().healthy;
  }
}

export default SchedulerHealth;