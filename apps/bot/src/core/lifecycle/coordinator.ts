/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : coordinator.ts
 * Purpose : Centralized shutdown coordinator.
 * =========================================================
 */

import { ShutdownPipeline } from "./shutdown.js";

/**
 * Coordinates graceful application shutdown.
 *
 * Future milestones will register cleanup tasks
 * (Discord, Database, Dashboard, API, Scheduler,
 * AI, Plugins, etc.) before the shutdown pipeline
 * executes.
 */
export class ShutdownCoordinator {
  /**
   * Indicates whether shutdown has been requested.
   */
  private static shuttingDown = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a coordinated application shutdown.
   *
   * Safe to call multiple times.
   */
  public static async shutdown(): Promise<void> {
    if (ShutdownCoordinator.shuttingDown) {
      return;
    }

    ShutdownCoordinator.shuttingDown = true;

    /**
     * Future cleanup coordinators will execute here.
     */

    await ShutdownPipeline.stop();
  }

  /**
   * Indicates whether shutdown is currently in progress.
   *
   * @returns Shutdown status.
   */
  public static isShuttingDown(): boolean {
    return ShutdownCoordinator.shuttingDown;
  }
}

export default ShutdownCoordinator;