/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitor.ts
 * Purpose : Scheduler monitoring service.
 * =========================================================
 */

import { SchedulerHealth } from "./health.js";
import { SchedulerLoader } from "./loader.js";
import { SchedulerQueue } from "./queue.js";
import { SchedulerRecoveryManager } from "./recovery.js";
import { SchedulerStore } from "./store.js";
import { SchedulerWorker } from "./worker.js";

/**
 * Scheduler monitoring snapshot.
 */
export interface SchedulerMonitoringSnapshot {
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

  /**
   * Snapshot timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Scheduler monitoring service.
 */
export class SchedulerMonitor {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a monitoring snapshot.
   *
   * @returns Monitoring snapshot.
   */
  public static snapshot():
    Readonly<SchedulerMonitoringSnapshot> {

    return Object.freeze({
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

      timestamp:
        new Date(),
    });
  }

  /**
   * Determines whether the scheduler
   * framework is operational.
   *
   * @returns True if operational.
   */
  public static isOperational(): boolean {
    return SchedulerHealth.isHealthy();
  }

  /**
   * Returns the number of pending
   * scheduler executions.
   *
   * @returns Pending scheduler count.
   */
  public static pending(): number {
    return SchedulerQueue.size();
  }

  /**
   * Returns the number of active
   * scheduler workers.
   *
   * @returns Active worker count.
   */
  public static workers(): number {
    return SchedulerWorker.count();
  }
}

export default SchedulerMonitor;