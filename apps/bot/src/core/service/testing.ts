/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Service framework testing utilities.
 * =========================================================
 */

import { ServiceEngine } from "./engine.js";
import { ServiceHealth } from "./health.js";
import { ServiceRegistry } from "./registry.js";
import { ServiceStore } from "./store.js";

/**
 * Result of a service framework test.
 */
export interface ServiceTestResult {
  /**
   * Whether every test passed.
   */
  readonly passed: boolean;

  /**
   * Number of registered services.
   */
  readonly registeredServices: number;

  /**
   * Number of active services.
   */
  readonly activeServices: number;

  /**
   * Whether the engine is running.
   */
  readonly engineRunning: boolean;

  /**
   * Whether the framework is healthy.
   */
  readonly healthy: boolean;

  /**
   * Test execution time.
   */
  readonly timestamp: Date;
}

/**
 * Service framework testing.
 */
export class ServiceTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes the service framework tests.
   *
   * @returns Test result.
   */
  public static run(): ServiceTestResult {
    const registeredServices =
      ServiceRegistry.getAll().length;

    const activeServices =
      ServiceStore.size();

    const engineRunning =
      ServiceEngine.isRunning();

    const healthy =
      ServiceHealth.isHealthy();

    const passed =
      registeredServices >= activeServices &&
      (!engineRunning || healthy);

    return Object.freeze({
      passed,
      registeredServices,
      activeServices,
      engineRunning,
      healthy,
      timestamp: new Date(),
    });
  }

  /**
   * Returns whether every test passes.
   *
   * @returns True if successful.
   */
  public static passed(): boolean {
    return ServiceTesting.run().passed;
  }
}

export default ServiceTesting;