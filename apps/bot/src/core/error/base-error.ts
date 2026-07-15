/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : base-error.ts
 * Purpose : Base error class for the SRB NEXUS runtime.
 * =========================================================
 */

export interface NexusErrorOptions {
  /**
   * Unique machine-readable error code.
   *
   * Example:
   * CONFIG_INVALID
   * DISCORD_LOGIN_FAILED
   */
  code: string;

  /**
   * Optional underlying cause.
   */
  cause?: unknown;

  /**
   * Optional structured metadata.
   */
  context?: Record<string, unknown>;
}

/**
 * Base error for the SRB NEXUS platform.
 *
 * Every framework-specific error should extend this class.
 */
export class NexusError extends Error {
  /**
   * Machine-readable error identifier.
   */
  public readonly code: string;

  /**
   * Error creation timestamp.
   */
  public readonly timestamp: Date;

  /**
   * Optional underlying error.
   */
  public override readonly cause?: unknown;

  /**
   * Optional structured context.
   */
  public readonly context: Readonly<Record<string, unknown>>;

  /**
   * Creates a new NexusError.
   */
  public constructor(
    message: string,
    options: NexusErrorOptions,
  ) {
    super(message);

    this.name = new.target.name;

    this.code = options.code;

    this.timestamp = new Date();

    this.cause = options.cause;

    this.context = Object.freeze({
      ...(options.context ?? {}),
    });

    Object.setPrototypeOf(this, new.target.prototype);

    Error.captureStackTrace?.(this, new.target);

    Object.freeze(this);
  }

  /**
   * Serializes the error into a structured object.
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
    };
  }

  /**
   * Human-readable representation.
   */
  public override toString(): string {
    return `[${this.code}] ${this.message}`;
  }
}