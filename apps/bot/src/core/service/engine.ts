/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : engine.ts
 * Purpose : Service execution engine.
 * =========================================================
 */

import { ServiceLoader } from "./loader.js";
import { ServiceStore } from "./store.js";
import { ServiceDefinition } from "./registry.js";

/**
 * Service execution engine.
 */
export class ServiceEngine {
  /**
   * Engine running state.
   */
  private static running = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Starts the engine.
   */
  public static start(): void {
    if (ServiceEngine.running) {
      return;
    }

    const services = ServiceLoader.loadAll();

    ServiceStore.setMany(services);

    ServiceEngine.running = true;
  }

  /**
   * Stops the engine.
   */
  public static stop(): void {
    if (!ServiceEngine.running) {
      return;
    }

    ServiceStore.clear();
    ServiceLoader.clear();

    ServiceEngine.running = false;
  }

  /**
   * Restarts the engine.
   */
  public static restart(): void {
    ServiceEngine.stop();
    ServiceEngine.start();
  }

  /**
   * Returns whether the engine is running.
   *
   * @returns Running state.
   */
  public static isRunning(): boolean {
    return ServiceEngine.running;
  }

  /**
   * Returns every active service.
   *
   * @returns Active services.
   */
  public static services():
    readonly ServiceDefinition[] {

    return ServiceStore.getAll();
  }

  /**
   * Returns the number of active services.
   *
   * @returns Service count.
   */
  public static count(): number {
    return ServiceStore.size();
  }
}

export default ServiceEngine;