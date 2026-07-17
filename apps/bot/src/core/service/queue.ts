/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : queue.ts
 * Purpose : Service execution queue.
 * =========================================================
 */

import { ServiceDefinition } from "./registry.js";

/**
 * Service execution queue.
 */
export class ServiceQueue {
  /**
   * Pending services.
   */
  private readonly queue: ServiceDefinition[] = [];

  /**
   * Adds a service to the queue.
   *
   * @param service Service definition.
   */
  public enqueue(
    service: ServiceDefinition,
  ): void {
    this.queue.push(service);
  }

  /**
   * Removes the next service.
   *
   * @returns Next service or undefined.
   */
  public dequeue():
    | ServiceDefinition
    | undefined {

    return this.queue.shift();
  }

  /**
   * Returns the next service.
   *
   * @returns Next queued service.
   */
  public peek():
    | ServiceDefinition
    | undefined {

    return this.queue.at(0);
  }

  /**
   * Returns every queued service.
   *
   * @returns Queued services.
   */
  public getAll():
    readonly ServiceDefinition[] {

    return Object.freeze([
      ...this.queue,
    ]);
  }

  /**
   * Returns the queue size.
   *
   * @returns Queue length.
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Returns whether the queue is empty.
   *
   * @returns True if empty.
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clears the queue.
   */
  public clear(): void {
    this.queue.length = 0;
  }
}

export default ServiceQueue;