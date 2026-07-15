/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : startup-error.ts
 * Purpose : Startup-specific error implementation.
 * =========================================================
 */

import {
  NexusError,
  type NexusErrorOptions,
} from "./base-error.js";

/**
 * Startup error options.
 */
export interface StartupErrorOptions
  extends Omit<NexusErrorOptions, "code"> {}

/**
 * Error thrown when the application fails during
 * initialization or startup.
 */
export class StartupError extends NexusError {
  /**
   * Default machine-readable error code.
   */
  public static readonly CODE = "STARTUP_ERROR";

  /**
   * Creates a new StartupError.
   */
  public constructor(
    message: string,
    options: StartupErrorOptions = {},
  ) {
    super(message, {
      code: StartupError.CODE,
      cause: options.cause,
      context: options.context,
    });
  }
}