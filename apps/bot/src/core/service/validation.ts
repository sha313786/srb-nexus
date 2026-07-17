/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Service validation manager.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

import {
  ServiceDefinition,
  ServiceRegistry,
} from "./registry.js";

/**
 * Service validation manager.
 */
export class ServiceValidation {
  /**
   * Semantic version pattern.
   */
  private static readonly VERSION_PATTERN =
    /^\d+\.\d+\.\d+$/;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Validates a service definition.
   *
   * @param service Service definition.
   *
   * @returns True if valid.
   */
  public static validate(
    service: ServiceDefinition,
  ): boolean {
    if (!service.id.trim()) {
      throw new ConfigurationError(
        "Service id cannot be empty.",
      );
    }

    if (!service.name.trim()) {
      throw new ConfigurationError(
        "Service name cannot be empty.",
      );
    }

    if (!service.description.trim()) {
      throw new ConfigurationError(
        "Service description cannot be empty.",
      );
    }

    if (!service.version.trim()) {
      throw new ConfigurationError(
        "Service version cannot be empty.",
      );
    }

    if (
      !ServiceValidation.VERSION_PATTERN.test(
        service.version,
      )
    ) {
      throw new ConfigurationError(
        `Invalid service version "${service.version}".`,
      );
    }

    return true;
  }

  /**
   * Validates every registered service.
   *
   * @returns True if all services are valid.
   */
  public static validateAll(): boolean {
    for (const service of ServiceRegistry.getAll()) {
      ServiceValidation.validate(service);
    }

    return true;
  }

  /**
   * Determines whether a service is valid.
   *
   * @param service Service definition.
   *
   * @returns True if valid.
   */
  public static isValid(
    service: ServiceDefinition,
  ): boolean {
    try {
      return ServiceValidation.validate(
        service,
      );
    } catch {
      return false;
    }
  }
}

export default ServiceValidation;