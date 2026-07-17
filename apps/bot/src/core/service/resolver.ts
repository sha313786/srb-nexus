/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Service resolution manager.
 * =========================================================
 */

import {
  ServiceDefinition,
  ServiceRegistry,
} from "./registry.js";

/**
 * Service resolution manager.
 */
export class ServiceResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a registered service.
   *
   * @param id Service identifier.
   *
   * @returns Service definition.
   */
  public static resolve(
    id: string,
  ): ServiceDefinition {
    return ServiceRegistry.resolve(id);
  }

  /**
   * Attempts to resolve a service.
   *
   * @param id Service identifier.
   *
   * @returns Service definition or undefined.
   */
  public static tryResolve(
    id: string,
  ): ServiceDefinition | undefined {
    if (!ServiceRegistry.has(id)) {
      return undefined;
    }

    return ServiceRegistry.resolve(id);
  }

  /**
   * Determines whether a service exists.
   *
   * @param id Service identifier.
   *
   * @returns True if registered.
   */
  public static exists(
    id: string,
  ): boolean {
    return ServiceRegistry.has(id);
  }

  /**
   * Resolves every registered service.
   *
   * @returns Registered services.
   */
  public static resolveAll():
    readonly ServiceDefinition[] {

    return ServiceRegistry.getAll();
  }
}

export default ServiceResolver;