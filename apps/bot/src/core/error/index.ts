/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the SRB NEXUS Error Framework.
 * =========================================================
 */

/**
 * Base Error
 */
export { NexusError } from "./base-error.js";

/**
 * Error Types
 */
export { ConfigurationError } from "./configuration-error.js";
export { ValidationError } from "./validation-error.js";
export { StartupError } from "./startup-error.js";
export { DiscordError } from "./discord-error.js";

/**
 * Error Utilities
 */
export {
  getErrorMessage,
  isNativeError,
  isNexusError,
  normalizeUnknownError,
} from "./utilities.js";

/**
 * Types
 */
export type { NexusErrorOptions } from "./base-error.js";
export type { ConfigurationErrorOptions } from "./configuration-error.js";
export type { ValidationErrorOptions } from "./validation-error.js";
export type { StartupErrorOptions } from "./startup-error.js";
export type { DiscordErrorOptions } from "./discord-error.js";