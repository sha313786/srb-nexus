/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized service resolver.
 * =========================================================
 */

import { ServiceContainer } from "./container.js";

/**
 * Centralized service resolver.
 *
 * This class provides read-only access to services
 * registered in the ServiceContainer.
 *
 * It intentionally cannot register, remove or modify
 * services.
 */
export class ServiceResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a registered service.
   *
   * @param key Unique service identifier.
   *
   * @returns Registered service instance.
   */
  public static resolve<T>(
    key: string,
  ): T {
    return ServiceContainer.resolve<T>(key);
  }

  /**
   * Determines whether a service has been registered.
   *
   * @param key Unique service identifier.
   *
   * @returns True if the service exists.
   */
  public static has(
    key: string,
  ): boolean {
    return ServiceContainer.has(key);
  }
}

export default ServiceResolver;