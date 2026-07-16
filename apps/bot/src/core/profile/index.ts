/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the profile framework.
 * =========================================================
 */

export { ProfileRegistry } from "./registry.js";
export { ProfileRegistration } from "./registration.js";
export { ProfileResolver } from "./resolver.js";
export { ProfileValidation } from "./validation.js";
export { ProfileLoader } from "./loader.js";
export { ProfileManager } from "./manager.js";
export { ProfileContextFactory } from "./context.js";
export { ProfileStore } from "./store.js";

export {
  EnvironmentProfile,
  EnvironmentProfileManager,
} from "./environment.js";

export { ProfileMerge } from "./merge.js";
export { ProfileOverrideManager } from "./override.js";

export {
  ProfileEvent,
  ProfileEventManager,
} from "./events.js";

export { ProfileHealth } from "./health.js";
export { ProfileRecoveryManager } from "./recovery.js";
export { ProfileTesting } from "./testing.js";

export type { ProfileDefinition } from "./registry.js";
export type { ProfileContext } from "./context.js";
export type { ProfileMergeResult } from "./merge.js";
export type { ProfileOverride } from "./override.js";
export type { ProfileEventPayload } from "./events.js";
export type { ProfileHealthReport } from "./health.js";
export type { FailedProfile } from "./recovery.js";
export type { ProfileFrameworkReport } from "./testing.js";