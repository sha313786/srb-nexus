/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : handler.ts
 * Purpose : Global error handler for the SRB NEXUS runtime.
 * =========================================================
 */

import { NexusError } from "./base-error.js";
import {
  getErrorMessage,
  isNexusError,
  normalizeUnknownError,
} from "./utilities.js";

/**
 * Result returned by the GlobalErrorHandler.
 */
export interface ErrorHandlerResult {
  /**
   * Normalized error instance.
   */
  readonly error: Error;

  /**
   * Human-readable message.
   */
  readonly message: string;

  /**
   * Indicates whether the error is a NexusError.
   */
  readonly isNexusError: boolean;

  /**
   * Indicates whether the error can be recovered from.
   */
  readonly isRecoverable: boolean;
}

/**
 * Centralized error handling for the SRB NEXUS runtime.
 *
 * This handler is intentionally logger-independent.
 * Logger integration will be added in a later milestone.
 */
export class GlobalErrorHandler {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Handles an unknown error.
   *
   * @param error Unknown thrown value.
   * @returns Structured handling result.
   */
  public static handle(error: unknown): ErrorHandlerResult {
    const normalized = normalizeUnknownError(error);

    return Object.freeze({
      error: normalized,
      message: getErrorMessage(error),
      isNexusError: isNexusError(normalized),
      isRecoverable: GlobalErrorHandler.isRecoverable(normalized),
    });
  }

  /**
   * Determines whether an error is recoverable.
   *
   * Current implementation treats every handled error
   * as recoverable. Future milestones may introduce
   * severity-based policies.
   *
   * @param error Normalized error.
   * @returns Recovery status.
   */
  private static isRecoverable(error: Error): boolean {
    if (error instanceof NexusError) {
      return true;
    }

    return true;
  }
}

export default GlobalErrorHandler;