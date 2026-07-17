/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Scheduler validation service.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

import {
  SchedulerDefinition,
  SchedulerRegistry,
} from "./registry.js";

/**
 * Scheduler validation service.
 */
export class SchedulerValidation {
  /**
   * Basic cron expression validation.
   */
  private static readonly CRON_PATTERN =
    /^(\S+\s+){4,6}\S+$/;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Validates a scheduler definition.
   *
   * @param scheduler Scheduler definition.
   *
   * @returns True when valid.
   */
  public static validate(
    scheduler: SchedulerDefinition,
  ): boolean {
    if (!scheduler.id.trim()) {
      throw new ConfigurationError(
        "Scheduler id cannot be empty.",
      );
    }

    if (!scheduler.name.trim()) {
      throw new ConfigurationError(
        "Scheduler name cannot be empty.",
      );
    }

    if (!scheduler.schedule.trim()) {
      throw new ConfigurationError(
        "Scheduler schedule cannot be empty.",
      );
    }

    if (
      !SchedulerValidation.CRON_PATTERN.test(
        scheduler.schedule,
      )
    ) {
      throw new ConfigurationError(
        `Invalid cron expression "${scheduler.schedule}".`,
      );
    }

    return true;
  }

  /**
   * Validates every registered scheduler.
   *
   * @returns True if every scheduler is valid.
   */
  public static validateAll(): boolean {
    for (const scheduler of SchedulerRegistry.getAll()) {
      SchedulerValidation.validate(
        scheduler,
      );
    }

    return true;
  }

  /**
   * Determines whether a scheduler is valid.
   *
   * @param scheduler Scheduler definition.
   *
   * @returns True if valid.
   */
  public static isValid(
    scheduler: SchedulerDefinition,
  ): boolean {
    try {
      return SchedulerValidation.validate(
        scheduler,
      );
    } catch {
      return false;
    }
  }
}

export default SchedulerValidation;