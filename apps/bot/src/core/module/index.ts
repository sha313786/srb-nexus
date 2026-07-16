/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the module package.
 * =========================================================
 */

/**
 * Module Registry
 */
export {
  ModuleRegistry,
} from "./registry.js";

/**
 * Module Registration
 */
export {
  ModuleRegistration,
} from "./registration.js";

/**
 * Module Resolver
 */
export {
  ModuleResolver,
} from "./resolver.js";

/**
 * Module Validation
 */
export {
  ModuleValidation,
} from "./validation.js";

/**
 * Types
 */
export type {
  ModuleDefinition,
} from "./registry.js";