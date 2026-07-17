/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : store.ts
 * Purpose : Runtime service storage.
 * =========================================================
 */

import { ServiceDefinition } from "./registry.js";

/**
 * Runtime service store.
 */
export class ServiceStore {
  /**
   * Runtime service storage.
   */
  private static readonly store =
    new Map<string, ServiceDefinition>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Stores a service.
   *
   * @param service Service definition.
   */
  public static set(
    service: ServiceDefinition,
  ): void {
    ServiceStore.store.set(
      service.id,
      service,
    );
  }

  /**
   * Stores multiple services.
   *
   * @param services Service definitions.
   */
  public static setMany(
    services: readonly ServiceDefinition[],
  ): void {
    for (const service of services) {
      ServiceStore.set(service);
    }
  }

  /**
   * Retrieves a stored service.
   *
   * @param id Service identifier.
   *
   * @returns Stored service or undefined.
   */
  public static get(
    id: string,
  ): ServiceDefinition | undefined {
    return ServiceStore.store.get(id);
  }

  /**
   * Determines whether a service exists.
   *
   * @param id Service identifier.
   *
   * @returns True if stored.
   */
  public static has(
    id: string,
  ): boolean {
    return ServiceStore.store.has(id);
  }

  /**
   * Removes a stored service.
   *
   * @param id Service identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return ServiceStore.store.delete(id);
  }

  /**
   * Returns every stored service.
   *
   * @returns Stored services.
   */
  public static getAll():
    readonly ServiceDefinition[] {

    return Object.freeze([
      ...ServiceStore.store.values(),
    ]);
  }

  /**
   * Returns the number of stored services.
   *
   * @returns Service count.
   */
  public static size(): number {
    return ServiceStore.store.size;
  }

  /**
   * Clears the runtime store.
   */
  public static clear(): void {
    ServiceStore.store.clear();
  }
}

export default ServiceStore;