/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : utilities.ts
 * Purpose : Error utility functions for the SRB NEXUS runtime.
 * =========================================================
 */

import { NexusError } from "./base-error.js";

/**
 * Determines whether the supplied value is a NexusError.
 *
 * @param value Value to test.
 * @returns True if the value is a NexusError.
 */
export function isNexusError(value: unknown): value is NexusError {
  return value instanceof NexusError;
}

/**
 * Determines whether the supplied value is a native Error.
 *
 * @param value Value to test.
 * @returns True if the value is an Error.
 */
export function isNativeError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Normalizes an unknown thrown value into an Error instance.
 *
 * @param value Unknown thrown value.
 * @returns Error instance.
 */
export function normalizeUnknownError(value: unknown): Error {
  if (isNexusError(value)) {
    return value;
  }

  if (isNativeError(value)) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  return new Error("An unknown error occurred.");
}

/**
 * Safely extracts a readable message from any thrown value.
 *
 * @param value Unknown thrown value.
 * @returns Human-readable error message.
 */
export function getErrorMessage(value: unknown): string {
  if (isNexusError(value)) {
    return value.message;
  }

  if (isNativeError(value)) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "An unknown error occurred.";
}