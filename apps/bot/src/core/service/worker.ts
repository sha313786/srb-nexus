/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : worker.ts
 * Purpose : Service execution worker.
 * =========================================================
 */

import { ServiceDefinition } from "./registry.js";

/**
 * Service worker state.
 */
export enum ServiceWorkerState {
  Idle = "idle",
  Running = "running",
  Stopped = "stopped",
}

/**
 * Service execution worker.
 */
export class ServiceWorker {
  /**
   * Worker state.
   */
  private state =
    ServiceWorkerState.Idle;

  /**
   * Creates a worker.
   *
   * @param service Service definition.
   */
  public constructor(
    private readonly service: ServiceDefinition,
  ) {}

  /**
   * Starts the worker.
   */
  public start(): void {
    this.state =
      ServiceWorkerState.Running;
  }

  /**
   * Stops the worker.
   */
  public stop(): void {
    this.state =
      ServiceWorkerState.Stopped;
  }

  /**
   * Restarts the worker.
   */
  public restart(): void {
    this.stop();
    this.start();
  }

  /**
   * Returns the associated service.
   *
   * @returns Service definition.
   */
  public getService(): ServiceDefinition {
    return this.service;
  }

  /**
   * Returns the current state.
   *
   * @returns Worker state.
   */
  public getState(): ServiceWorkerState {
    return this.state;
  }

  /**
   * Returns whether the worker is running.
   *
   * @returns True if running.
   */
  public isRunning(): boolean {
    return (
      this.state ===
      ServiceWorkerState.Running
    );
  }
}

export default ServiceWorker;