/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : startup.ts
 * Purpose : Application startup pipeline.
 * =========================================================
 */

import { LifecycleManager } from "./manager.js";
import { ApplicationState } from "./state.js";

/**
 * Centralized startup pipeline for the SRB NEXUS application.
 *
 * This class is intentionally independent of Discord,
 * Logger, API, Database and all runtime modules.
 */
export class StartupPipeline {
  /**
   * Indicates whether the startup pipeline has completed.
   */
  private static started = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes the application startup pipeline.
   *
   * Startup sequence:
   *
   * CREATED
   *      ↓
   * INITIALIZING
   *      ↓
   * RUNNING
   */
  public static async start(): Promise<void> {
    if (StartupPipeline.started) {
      return;
    }

    LifecycleManager.setState(
      ApplicationState.INITIALIZING,
    );

    /**
     * Future startup steps will be registered here.
     *
     * Examples:
     * - Environment validation
     * - Logger initialization
     * - Discord client login
     * - Dashboard startup
     * - API startup
     * - Module initialization
     */

    LifecycleManager.setState(
      ApplicationState.RUNNING,
    );

    StartupPipeline.started = true;
  }

  /**
   * Indicates whether startup has completed.
   *
   * @returns Startup status.
   */
  public static isStarted(): boolean {
    return StartupPipeline.started;
  }
}

export default StartupPipeline;