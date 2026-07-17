/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : dispatcher.ts
 * Purpose : Service execution dispatcher.
 * =========================================================
 */

import { ServiceDefinition } from "./registry.js";
import { ServiceQueue } from "./queue.js";
import { ServiceWorker } from "./worker.js";

/**
 * Service execution dispatcher.
 */
export class ServiceDispatcher {
  /**
   * Execution queue.
   */
  private readonly queue =
    new ServiceQueue();

  /**
   * Active workers.
   */
  private readonly workers =
    new Map<string, ServiceWorker>();

  /**
   * Queues a service.
   *
   * @param service Service definition.
   */
  public dispatch(
    service: ServiceDefinition,
  ): void {
    this.queue.enqueue(service);
  }

  /**
   * Processes every queued service.
   */
  public process(): void {
    while (!this.queue.isEmpty()) {
      const service =
        this.queue.dequeue();

      if (!service) {
        continue;
      }

      const worker =
        new ServiceWorker(service);

      worker.start();

      this.workers.set(
        service.id,
        worker,
      );
    }
  }

  /**
   * Stops a worker.
   *
   * @param id Service identifier.
   *
   * @returns True if stopped.
   */
  public stop(
    id: string,
  ): boolean {
    const worker =
      this.workers.get(id);

    if (!worker) {
      return false;
    }

    worker.stop();

    return this.workers.delete(id);
  }

  /**
   * Stops every worker.
   */
  public stopAll(): void {
    for (const worker of this.workers.values()) {
      worker.stop();
    }

    this.workers.clear();
  }

  /**
   * Returns an active worker.
   *
   * @param id Service identifier.
   *
   * @returns Worker or undefined.
   */
  public getWorker(
    id: string,
  ): ServiceWorker | undefined {
    return this.workers.get(id);
  }

  /**
   * Returns every active worker.
   *
   * @returns Workers.
   */
  public getWorkers():
    readonly ServiceWorker[] {

    return Object.freeze([
      ...this.workers.values(),
    ]);
  }

  /**
   * Returns the number of active workers.
   *
   * @returns Worker count.
   */
  public count(): number {
    return this.workers.size;
  }

  /**
   * Returns whether there are active workers.
   *
   * @returns True if active.
   */
  public hasWorkers(): boolean {
    return this.workers.size > 0;
  }
}

export default ServiceDispatcher;