/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : queue.ts
 * Purpose : Scheduler execution queue.
 * =========================================================
 */

import { SchedulerDefinition } from "./registry.js";

/**
 * Scheduler execution queue.
 */
export class SchedulerQueue {
  /**
   * Pending scheduler queue.
   */
  private static readonly queue: SchedulerDefinition[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Adds a scheduler to the queue.
   *
   * @param scheduler Scheduler definition.
   */
  public static enqueue(
    scheduler: SchedulerDefinition,
  ): void {
    SchedulerQueue.queue.push(scheduler);
  }

  /**
   * Adds multiple schedulers to the queue.
   *
   * @param schedulers Scheduler definitions.
   */
  public static enqueueMany(
    schedulers: readonly SchedulerDefinition[],
  ): void {
    for (const scheduler of schedulers) {
      SchedulerQueue.enqueue(scheduler);
    }
  }

  /**
   * Removes the next scheduler from the queue.
   *
   * @returns Scheduler definition or undefined.
   */
  public static dequeue():
    | SchedulerDefinition
    | undefined {
    return SchedulerQueue.queue.shift();
  }

  /**
   * Returns the next scheduler without removing it.
   *
   * @returns Scheduler definition or undefined.
   */
  public static peek():
    | SchedulerDefinition
    | undefined {
    return SchedulerQueue.queue[0];
  }

  /**
   * Determines whether the queue is empty.
   *
   * @returns True if empty.
   */
  public static isEmpty(): boolean {
    return SchedulerQueue.queue.length === 0;
  }

  /**
   * Returns every queued scheduler.
   *
   * @returns Queued schedulers.
   */
  public static getAll():
    readonly SchedulerDefinition[] {
    return Object.freeze([
      ...SchedulerQueue.queue,
    ]);
  }

  /**
   * Returns the number of queued schedulers.
   *
   * @returns Queue size.
   */
  public static size(): number {
    return SchedulerQueue.queue.length;
  }

  /**
   * Clears the scheduler queue.
   */
  public static clear(): void {
    SchedulerQueue.queue.length = 0;
  }
}

export default SchedulerQueue;