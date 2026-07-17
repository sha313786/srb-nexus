/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitoring.ts
 * Purpose : Service monitoring framework.
 * =========================================================
 */

import { ServiceEngine } from "./engine.js";
import { ServiceHealth } from "./health.js";
import { ServiceStore } from "./store.js";

/**
 * Monitoring snapshot.
 */
export interface ServiceMonitoringSnapshot {
  /**
   * Engine running state.
   */
  readonly running: boolean;

  /**
   * Framework health.
   */
  readonly healthy: boolean;

  /**
   * Active service count.
   */
  readonly services: number;

  /**
   * Snapshot timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Service monitoring framework.
 */
export class ServiceMonitoring {
  /**
   * Latest monitoring snapshot.
   */
  private static snapshot:
    ServiceMonitoringSnapshot | null = null;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Captures the current framework state.
   *
   * @returns Monitoring snapshot.
   */
  public static capture():
    Readonly<ServiceMonitoringSnapshot> {

    ServiceMonitoring.snapshot = Object.freeze({
      running: ServiceEngine.isRunning(),
      healthy: ServiceHealth.isHealthy(),
      services: ServiceStore.size(),
      timestamp: new Date(),
    });

    return ServiceMonitoring.snapshot;
  }

  /**
   * Returns the latest snapshot.
   *
   * @returns Monitoring snapshot.
   */
  public static latest():
    Readonly<ServiceMonitoringSnapshot> {

    return (
      ServiceMonitoring.snapshot ??
      ServiceMonitoring.capture()
    );
  }

  /**
   * Clears monitoring data.
   */
  public static reset(): void {
    ServiceMonitoring.snapshot = null;
  }
}

export default ServiceMonitoring;