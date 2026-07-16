/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : state.ts
 * Purpose : Defines the application lifecycle states.
 * =========================================================
 */

/**
 * Represents the lifecycle state of the SRB NEXUS application.
 *
 * Every subsystem must reference this enum when determining
 * the current execution state of the application.
 */
export enum ApplicationState {
  /**
   * Application has been created but has not started initialization.
   */
  CREATED = "CREATED",

  /**
   * Application is initializing services and modules.
   */
  INITIALIZING = "INITIALIZING",

  /**
   * Application is fully operational.
   */
  RUNNING = "RUNNING",

  /**
   * Application is performing a graceful shutdown.
   */
  STOPPING = "STOPPING",

  /**
   * Application has completely stopped.
   */
  STOPPED = "STOPPED",
}