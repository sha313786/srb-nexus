/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Central service registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Service definition.
 */
export interface ServiceDefinition {
  /**
   * Unique service identifier.
   */
  readonly id: string;

  /**
   * Service name.
   */
  readonly name: string;

  /**
   * Service description.
   */
  readonly description: string;

  /**
   * Service version.
   */
  readonly version: string;

  /**
   * Indicates whether the service is enabled.
   */
  readonly enabled: boolean;
}

/**
 * Central service registry.
 */
export class ServiceRegistry {
  /**
   * Registered services.
   */
  private static readonly services =
    new Map<string, ServiceDefinition>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a service.
   *
   * @param service Service definition.
   */
  public static register(
    service: ServiceDefinition,
  ): void {
    if (ServiceRegistry.services.has(service.id)) {
      throw new ConfigurationError(
        `Service "${service.id}" is already registered.`,
      );
    }

    ServiceRegistry.services.set(
      service.id,
      service,
    );
  }

  /**
   * Resolves a service.
   *
   * @param id Service identifier.
   *
   * @returns Registered service.
   */
  public static resolve(
    id: string,
  ): ServiceDefinition {
    const service =
      ServiceRegistry.services.get(id);

    if (!service) {
      throw new ConfigurationError(
        `Service "${id}" is not registered.`,
      );
    }

    return service;
  }

  /**
   * Determines whether a service exists.
   *
   * @param id Service identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return ServiceRegistry.services.has(id);
  }

  /**
   * Returns every registered service.
   *
   * @returns Registered services.
   */
  public static getAll():
    readonly ServiceDefinition[] {
    return Object.freeze([
      ...ServiceRegistry.services.values(),
    ]);
  }

  /**
   * Removes a service.
   *
   * @param id Service identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return ServiceRegistry.services.delete(id);
  }

  /**
   * Clears the registry.
   */
  public static clear(): void {
    ServiceRegistry.services.clear();
  }
}

export default ServiceRegistry;