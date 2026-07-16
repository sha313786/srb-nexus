/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : shutdown.ts
 * Purpose : Application shutdown pipeline.
 * =========================================================
 */

import { LifecycleManager } from "./manager.js";
import { ApplicationState } from "./state.js";

/**
 * Centralized shutdown pipeline for the SRB NEXUS application.
 *
 * This class is intentionally independent of Discord,
 * Logger, API, Database and all runtime modules.
 */
export class ShutdownPipeline {
  /**
   * Indicates whether the shutdown pipeline has completed.
   */
  private static stopped = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes the application shutdown pipeline.
   *
   * Shutdown sequence:
   *
   * RUNNING
   *      ↓
   * STOPPING
   *      ↓
   * STOPPED
   */
  public static async stop(): Promise<void> {
    if (ShutdownPipeline.stopped) {
      return;
    }

    LifecycleManager.setState(
      ApplicationState.STOPPING,
    );

    /**
     * Future shutdown steps will be registered here.
     *
     * Examples:
     * - Stop Discord client
     * - Close API server
     * - Disconnect database
     * - Stop scheduler
     * - Flush logger
     * - Release resources
     */

    LifecycleManager.setState(
      ApplicationState.STOPPED,
    );

    ShutdownPipeline.stopped = true;
  }

  /**
   * Indicates whether shutdown has completed.
   *
   * @returns Shutdown status.
   */
  public static isStopped(): boolean {
    return ShutdownPipeline.stopped;
  }
}

export default ShutdownPipeline;