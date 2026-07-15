/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation-error.ts
 * Purpose : Validation-specific error implementation.
 * =========================================================
 */

import {
  NexusError,
  type NexusErrorOptions,
} from "./base-error.js";

/**
 * Validation error options.
 */
export interface ValidationErrorOptions
  extends Omit<NexusErrorOptions, "code"> {}

/**
 * Error thrown when user input or application data
 * fails validation.
 */
export class ValidationError extends NexusError {
  /**
   * Default machine-readable error code.
   */
  public static readonly CODE = "VALIDATION_ERROR";

  /**
   * Creates a new ValidationError.
   */
  public constructor(
    message: string,
    options: ValidationErrorOptions = {},
  ) {
    super(message, {
      code: ValidationError.CODE,
      cause: options.cause,
      context: options.context,
    });
  }
}