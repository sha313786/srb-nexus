/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : health.ts
 * Purpose : Service health manager.
 * =========================================================
 */

import { ServiceEngine } from "./engine.js";
import { ServiceStore } from "./store.js";

/**
 * Service health status.
 */
export enum ServiceHealthStatus {
  Healthy = "healthy",
  Degraded = "degraded",
  Unhealthy = "unhealthy",
}

/**
 * Health report.
 */
export interface ServiceHealthReport {
  readonly status: ServiceHealthStatus;
  readonly running: boolean;
  readonly services: number;
  readonly timestamp: Date;
}

/**
 * Service health manager.
 */
export class ServiceHealth {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the current health report.
   *
   * @returns Health report.
   */
  public static report(): ServiceHealthReport {
    const running =
      ServiceEngine.isRunning();

    const services =
      ServiceStore.size();

    let status =
      ServiceHealthStatus.Unhealthy;

    if (running && services > 0) {
      status =
        ServiceHealthStatus.Healthy;
    } else if (running) {
      status =
        ServiceHealthStatus.Degraded;
    }

    return Object.freeze({
      status,
      running,
      services,
      timestamp: new Date(),
    });
  }

  /**
   * Returns whether the service framework
   * is healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return (
      ServiceHealth.report().status ===
      ServiceHealthStatus.Healthy
    );
  }

  /**
   * Returns the current health status.
   *
   * @returns Health status.
   */
  public static status():
    ServiceHealthStatus {
    return ServiceHealth.report().status;
  }
}

export default ServiceHealth;