/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Service container validation utilities.
 * =========================================================
 */

import { ServiceContainer } from "./container.js";

/**
 * Container validation utilities.
 *
 * Provides helper methods for validating
 * service registration state.
 */
export class ContainerValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Ensures a service exists.
   *
   * @param key Service identifier.
   *
   * @returns True if the service exists.
   */
  public static validate(
    key: string,
  ): boolean {
    return ServiceContainer.has(key);
  }

  /**
   * Ensures every supplied service exists.
   *
   * @param keys Service identifiers.
   *
   * @returns True if all services exist.
   */
  public static validateAll(
    ...keys: readonly string[]
  ): boolean {
    return keys.every((key) =>
      ServiceContainer.has(key),
    );
  }

  /**
   * Finds services that are missing.
   *
   * @param keys Service identifiers.
   *
   * @returns Missing service identifiers.
   */
  public static getMissing(
    ...keys: readonly string[]
  ): string[] {
    return keys.filter(
      (key) => !ServiceContainer.has(key),
    );
  }
}

export default ContainerValidation;