/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : container.ts
 * Purpose : Centralized service container.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Centralized dependency injection container.
 *
 * Services are registered once and resolved throughout
 * the application lifecycle.
 *
 * This container is intentionally independent of Discord,
 * Logger, Database, API, Dashboard and runtime modules.
 */
export class ServiceContainer {
  /**
   * Registered services.
   */
  private static readonly services = new Map<string, unknown>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a service.
   *
   * @param key Unique service identifier.
   * @param instance Service instance.
   *
   * @throws ConfigurationError
   * If the service is already registered.
   */
  public static register<T>(
    key: string,
    instance: T,
  ): void {
    if (ServiceContainer.services.has(key)) {
      throw new ConfigurationError(
        `Service "${key}" is already registered.`,
      );
    }

    ServiceContainer.services.set(key, instance);
  }

  /**
   * Resolves a registered service.
   *
   * @param key Unique service identifier.
   *
   * @returns Registered service instance.
   *
   * @throws ConfigurationError
   * If the service is not registered.
   */
  public static resolve<T>(
    key: string,
  ): T {
    const service = ServiceContainer.services.get(key);

    if (service === undefined) {
      throw new ConfigurationError(
        `Service "${key}" is not registered.`,
      );
    }

    return service as T;
  }

  /**
   * Determines whether a service exists.
   *
   * @param key Unique service identifier.
   *
   * @returns True if registered.
   */
  public static has(
    key: string,
  ): boolean {
    return ServiceContainer.services.has(key);
  }

  /**
   * Removes a registered service.
   *
   * @param key Unique service identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    key: string,
  ): boolean {
    return ServiceContainer.services.delete(key);
  }

  /**
   * Clears all registered services.
   */
  public static clear(): void {
    ServiceContainer.services.clear();
  }
}

export default ServiceContainer;