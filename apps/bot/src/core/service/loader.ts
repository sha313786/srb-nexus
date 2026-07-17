/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : loader.ts
 * Purpose : Service loading framework.
 * =========================================================
 */

import {
  ServiceDefinition,
  ServiceRegistry,
} from "./registry.js";

/**
 * Service loader.
 */
export class ServiceLoader {
  /**
   * Loaded services.
   */
  private static readonly loaded =
    new Map<string, ServiceDefinition>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a service.
   *
   * @param id Service identifier.
   *
   * @returns Loaded service.
   */
  public static load(
    id: string,
  ): ServiceDefinition {
    const service =
      ServiceRegistry.resolve(id);

    ServiceLoader.loaded.set(
      id,
      service,
    );

    return service;
  }

  /**
   * Loads every registered service.
   *
   * @returns Loaded services.
   */
  public static loadAll():
    readonly ServiceDefinition[] {

    const loaded: ServiceDefinition[] = [];

    for (const service of ServiceRegistry.getAll()) {
      ServiceLoader.loaded.set(
        service.id,
        service,
      );

      loaded.push(service);
    }

    return Object.freeze(loaded);
  }

  /**
   * Determines whether a service is loaded.
   *
   * @param id Service identifier.
   *
   * @returns True if loaded.
   */
  public static isLoaded(
    id: string,
  ): boolean {
    return ServiceLoader.loaded.has(id);
  }

  /**
   * Returns every loaded service.
   *
   * @returns Loaded services.
   */
  public static getLoaded():
    readonly ServiceDefinition[] {

    return Object.freeze([
      ...ServiceLoader.loaded.values(),
    ]);
  }

  /**
   * Unloads a service.
   *
   * @param id Service identifier.
   *
   * @returns True if unloaded.
   */
  public static unload(
    id: string,
  ): boolean {
    return ServiceLoader.loaded.delete(id);
  }

  /**
   * Clears every loaded service.
   */
  public static clear(): void {
    ServiceLoader.loaded.clear();
  }
}

export default ServiceLoader;