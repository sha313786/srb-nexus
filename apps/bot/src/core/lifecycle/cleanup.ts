/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : cleanup.ts
 * Purpose : Resource cleanup manager.
 * =========================================================
 */

/**
 * Represents a cleanup task.
 */
export type CleanupTask = () => void | Promise<void>;

/**
 * Centralized resource cleanup manager.
 *
 * Future framework modules register cleanup tasks here.
 */
export class ResourceCleanup {
  /**
   * Registered cleanup tasks.
   */
  private static readonly tasks: CleanupTask[] = [];

  /**
   * Indicates whether cleanup has already executed.
   */
  private static completed = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a cleanup task.
   *
   * @param task Cleanup callback.
   */
  public static register(
    task: CleanupTask,
  ): void {
    ResourceCleanup.tasks.push(task);
  }

  /**
   * Executes every registered cleanup task.
   *
   * Safe to call multiple times.
   */
  public static async execute(): Promise<void> {
    if (ResourceCleanup.completed) {
      return;
    }

    for (const task of [...ResourceCleanup.tasks].reverse()) {
      await task();
    }

    ResourceCleanup.completed = true;
  }

  /**
   * Indicates whether cleanup has completed.
   *
   * @returns Cleanup status.
   */
  public static isCompleted(): boolean {
    return ResourceCleanup.completed;
  }

  /**
   * Returns the number of registered cleanup tasks.
   *
   * @returns Task count.
   */
  public static count(): number {
    return ResourceCleanup.tasks.length;
  }
}

export default ResourceCleanup;