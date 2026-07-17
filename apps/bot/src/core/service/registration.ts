/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Service registration manager.
 * =========================================================
 */

import {
  ServiceDefinition,
  ServiceRegistry,
} from "./registry.js";

/**
 * Service registration manager.
 */
export class ServiceRegistration {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a service.
   *
   * @param service Service definition.
   *
   * @returns Registered service.
   */
  public static register(
    service: ServiceDefinition,
  ): ServiceDefinition {
    ServiceRegistry.register(service);

    return service;
  }

  /**
   * Registers multiple services.
   *
   * @param services Service definitions.
   *
   * @returns Registered services.
   */
  public static registerMany(
    services: readonly ServiceDefinition[],
  ): readonly ServiceDefinition[] {
    for (const service of services) {
      ServiceRegistry.register(service);
    }

    return Object.freeze([...services]);
  }

  /**
   * Unregisters a service.
   *
   * @param id Service identifier.
   *
   * @returns True if removed.
   */
  public static unregister(
    id: string,
  ): boolean {
    return ServiceRegistry.remove(id);
  }

  /**
   * Clears every registered service.
   */
  public static clear(): void {
    ServiceRegistry.clear();
  }
}

export default ServiceRegistration;