/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Shutdown validation utilities.
 * =========================================================
 */

import { LifecycleManager } from "./manager.js";
import { ApplicationState } from "./state.js";
import { ShutdownCoordinator } from "./coordinator.js";
import { ResourceCleanup } from "./cleanup.js";

/**
 * Validation helpers for graceful shutdown.
 */
export class ShutdownValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns whether the application is currently
   * in the shutdown phase.
   *
   * @returns Shutdown state.
   */
  public static isShutdownInProgress(): boolean {
    return ShutdownCoordinator.isShuttingDown();
  }

  /**
   * Returns whether the shutdown process has completed.
   *
   * @returns Completion status.
   */
  public static isShutdownComplete(): boolean {
    return (
      LifecycleManager.is(ApplicationState.STOPPED) &&
      ResourceCleanup.isCompleted()
    );
  }

  /**
   * Returns the current lifecycle state.
   *
   * @returns Current application state.
   */
  public static getState(): ApplicationState {
    return LifecycleManager.getState();
  }

  /**
   * Returns whether cleanup has completed.
   *
   * @returns Cleanup status.
   */
  public static isCleanupComplete(): boolean {
    return ResourceCleanup.isCompleted();
  }
}

export default ShutdownValidation;