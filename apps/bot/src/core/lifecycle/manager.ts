/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Application lifecycle manager.
 * =========================================================
 */

import { ApplicationState } from "./state.js";

/**
 * Centralized manager responsible for tracking the current
 * lifecycle state of the SRB NEXUS application.
 *
 * This class is intentionally independent of Discord,
 * Logger, API, Database and all runtime modules.
 */
export class LifecycleManager {
  /**
   * Current application lifecycle state.
   */
  private static state: ApplicationState = ApplicationState.CREATED;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the current lifecycle state.
   *
   * @returns Current application state.
   */
  public static getState(): ApplicationState {
    return LifecycleManager.state;
  }

  /**
   * Updates the current lifecycle state.
   *
   * @param state New lifecycle state.
   */
  public static setState(state: ApplicationState): void {
    LifecycleManager.state = state;
  }

  /**
   * Determines whether the application is currently in
   * the specified lifecycle state.
   *
   * @param state Lifecycle state to compare.
   * @returns True if the current state matches.
   */
  public static is(state: ApplicationState): boolean {
    return LifecycleManager.state === state;
  }
}

export default LifecycleManager;