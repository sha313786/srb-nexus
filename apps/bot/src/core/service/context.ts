/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Service execution context.
 * =========================================================
 */

import { ServiceDefinition } from "./registry.js";

/**
 * Service execution context.
 */
export interface ServiceContext {
  /**
   * Service definition.
   */
  readonly service: ServiceDefinition;

  /**
   * Context creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Arbitrary execution metadata.
   */
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Service context factory.
 */
export class ServiceContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a service execution context.
   *
   * @param service Service definition.
   * @param metadata Optional metadata.
   *
   * @returns Service execution context.
   */
  public static create(
    service: ServiceDefinition,
    metadata: ReadonlyMap<string, unknown> = new Map(),
  ): ServiceContext {
    return Object.freeze({
      service,
      createdAt: new Date(),
      metadata,
    });
  }

  /**
   * Creates an empty context.
   *
   * @returns Empty service context.
   */
  public static empty(): ServiceContext {
    return Object.freeze({
      service: {
        id: "",
        name: "",
        description: "",
        version: "",
        enabled: false,
      },
      createdAt: new Date(),
      metadata: new Map(),
    });
  }
}

export default ServiceContextFactory;
