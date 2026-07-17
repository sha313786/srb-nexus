/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : dispatcher.ts
 * Purpose : Scheduler task dispatcher.
 * =========================================================
 */

import { SchedulerQueue } from "./queue.js";
import { SchedulerWorker } from "./worker.js";
import { SchedulerExecutionResult } from "./engine.js";

/**
 * Scheduler dispatcher.
 */
export class SchedulerDispatcher {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Dispatches the next scheduler in the queue.
   *
   * @returns Execution result or undefined if queue is empty.
   */
  public static async dispatchNext():
    Promise<SchedulerExecutionResult | undefined> {

    const scheduler = SchedulerQueue.dequeue();

    if (!scheduler) {
      return undefined;
    }

    return SchedulerWorker.run(scheduler);
  }

  /**
   * Dispatches every queued scheduler.
   *
   * @returns Execution results.
   */
  public static async dispatchAll():
    Promise<readonly SchedulerExecutionResult[]> {

    const results: SchedulerExecutionResult[] = [];

    while (!SchedulerQueue.isEmpty()) {
      const result =
        await SchedulerDispatcher.dispatchNext();

      if (result) {
        results.push(result);
      }
    }

    return Object.freeze(results);
  }

  /**
   * Returns whether the dispatcher has work pending.
   *
   * @returns True if queue contains tasks.
   */
  public static hasPending(): boolean {
    return !SchedulerQueue.isEmpty();
  }

  /**
   * Returns the current queue size.
   *
   * @returns Pending scheduler count.
   */
  public static pending(): number {
    return SchedulerQueue.size();
  }

  /**
   * Waits until every running scheduler completes.
   */
  public static async waitForIdle(): Promise<void> {
    await SchedulerWorker.waitAll();
  }
}

export default SchedulerDispatcher;