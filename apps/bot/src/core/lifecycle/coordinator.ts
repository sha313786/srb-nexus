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

import { ResourceCleanup } from "./cleanup.js";
import { ShutdownPipeline } from "./shutdown.js";

/**
 * Coordinates graceful application shutdown.
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
   */
  public static async shutdown(): Promise<void> {
    if (ShutdownCoordinator.shuttingDown) {
      return;
    }

    ShutdownCoordinator.shuttingDown = true;

    await ResourceCleanup.execute();

    await ShutdownPipeline.stop();
  }

  /**
   * Indicates whether shutdown is in progress.
   *
   * @returns Shutdown status.
   */
  public static isShuttingDown(): boolean {
    return ShutdownCoordinator.shuttingDown;
  }
}

export default ShutdownCoordinator;