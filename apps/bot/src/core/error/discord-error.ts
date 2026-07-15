/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : discord-error.ts
 * Purpose : Discord-specific error implementation.
 * =========================================================
 */

import {
  NexusError,
  type NexusErrorOptions,
} from "./base-error.js";

/**
 * Discord error options.
 */
export interface DiscordErrorOptions
  extends Omit<NexusErrorOptions, "code"> {}

/**
 * Error thrown when a Discord gateway,
 * REST, or client operation fails.
 */
export class DiscordError extends NexusError {
  /**
   * Default machine-readable error code.
   */
  public static readonly CODE = "DISCORD_ERROR";

  /**
   * Creates a new DiscordError.
   */
  public constructor(
    message: string,
    options: DiscordErrorOptions = {},
  ) {
    super(message, {
      code: DiscordError.CODE,
      cause: options.cause,
      context: options.context,
    });
  }
}