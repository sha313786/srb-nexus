/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validate.ts
 * Purpose : Environment validation utilities.
 * =========================================================
 */

import type { NodeEnvironment } from "./types.js";

/**
 * Returns a required environment variable.
 * Throws an error if the variable is missing or empty.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`,
    );
  }

  return value;
}

/**
 * Returns an optional environment variable.
 */
export function optionalEnv(
  name: string,
  defaultValue: string,
): string {
  const value = process.env[name]?.trim();

  return value && value.length > 0
    ? value
    : defaultValue;
}

/**
 * Validates NODE_ENV.
 */
export function getNodeEnvironment(): NodeEnvironment {
  const value = optionalEnv(
    "NODE_ENV",
    "development",
  );

  switch (value) {
    case "development":
    case "production":
    case "test":
      return value;

    default:
      throw new Error(
        `Invalid NODE_ENV "${value}". Expected development, production or test.`,
      );
  }
}