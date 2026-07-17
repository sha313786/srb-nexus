/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Service recovery manager.
 * =========================================================
 */

import { ServiceEngine } from "./engine.js";
import { ServiceHealth } from "./health.js";

/**
 * Service recovery manager.
 */
export class ServiceRecovery {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Attempts automatic recovery.
   *
   * @returns True if recovery succeeded.
   */
  public static recover(): boolean {
    if (ServiceHealth.isHealthy()) {
      return true;
    }

    ServiceEngine.restart();

    return ServiceHealth.isHealthy();
  }

  /**
   * Restarts the service engine.
   */
  public static restart(): void {
    ServiceEngine.restart();
  }

  /**
   * Performs a complete reset.
   */
  public static reset(): void {
    ServiceEngine.stop();
    ServiceEngine.start();
  }

  /**
   * Determines whether recovery is required.
   *
   * @returns True if recovery should run.
   */
  public static required(): boolean {
    return !ServiceHealth.isHealthy();
  }

  /**
   * Returns the current recovery state.
   *
   * @returns True if the framework is healthy.
   */
  public static verify(): boolean {
    return ServiceHealth.isHealthy();
  }
}

export default ServiceRecovery;