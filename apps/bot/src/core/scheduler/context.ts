/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Scheduler execution context.
 * =========================================================
 */

import { SchedulerDefinition } from "./registry.js";

/**
 * Scheduler execution context.
 */
export interface SchedulerContext {
  /**
   * Scheduler definition.
   */
  readonly scheduler: SchedulerDefinition;

  /**
   * Execution timestamp.
   */
  readonly startedAt: Date;

  /**
   * Arbitrary execution metadata.
   */
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Scheduler context factory.
 */
export class SchedulerContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a scheduler execution context.
   *
   * @param scheduler Scheduler definition.
   * @param metadata Optional execution metadata.
   *
   * @returns Scheduler execution context.
   */
  public static create(
    scheduler: SchedulerDefinition,
    metadata: ReadonlyMap<string, unknown> = new Map(),
  ): SchedulerContext {
    return Object.freeze({
      scheduler,
      startedAt: new Date(),
      metadata,
    });
  }

  /**
   * Creates an empty scheduler context.
   *
   * @returns Empty scheduler context.
   */
  public static empty(): SchedulerContext {
    return Object.freeze({
      scheduler: {
        id: "",
        name: "",
        description: "",
        schedule: "",
        enabled: false,
      },
      startedAt: new Date(),
      metadata: new Map(),
    });
  }
}

export default SchedulerContextFactory;