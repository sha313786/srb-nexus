/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : configuration-error.ts
 * Purpose : Configuration-specific error implementation.
 * =========================================================
 */

import {
  NexusError,
  type NexusErrorOptions,
} from "./base-error.js";

/**
 * Configuration error options.
 */
export interface ConfigurationErrorOptions
  extends Omit<NexusErrorOptions, "code"> {}

/**
 * Error thrown when application configuration is invalid
 * or required configuration is unavailable.
 */
export class ConfigurationError extends NexusError {
  /**
   * Default machine-readable error code.
   */
  public static readonly CODE = "CONFIGURATION_ERROR";

  /**
   * Creates a new ConfigurationError.
   */
  public constructor(
    message: string,
    options: ConfigurationErrorOptions = {},
  ) {
    super(message, {
      code: ConfigurationError.CODE,
      cause: options.cause,
      context: options.context,
    });
  }
}