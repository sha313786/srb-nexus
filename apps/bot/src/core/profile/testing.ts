/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : testing.ts
 * Purpose : Profile framework testing utilities.
 * =========================================================
 */

import { ProfileRegistry } from "./registry.js";
import { ProfileLoader } from "./loader.js";
import { ProfileStore } from "./store.js";
import { ProfileRecoveryManager } from "./recovery.js";
import { ProfileHealth } from "./health.js";

/**
 * Profile framework test report.
 */
export interface ProfileFrameworkReport {
  /**
   * Total registered profiles.
   */
  readonly registeredProfiles: number;

  /**
   * Total loaded profiles.
   */
  readonly loadedProfiles: number;

  /**
   * Total stored profiles.
   */
  readonly storedProfiles: number;

  /**
   * Failed profile operations.
   */
  readonly failedProfiles: number;

  /**
   * Overall framework health.
   */
  readonly healthy: boolean;
}

/**
 * Profile framework testing utilities.
 */
export class ProfileTesting {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a framework self-test.
   *
   * @returns Framework report.
   */
  public static selfTest(): Readonly<ProfileFrameworkReport> {
    return Object.freeze({
      registeredProfiles:
        ProfileRegistry.getAll().length,

      loadedProfiles:
        ProfileLoader.getLoaded().length,

      storedProfiles:
        ProfileStore.getAll().length,

      failedProfiles:
        ProfileRecoveryManager.count(),

      healthy:
        ProfileHealth.isHealthy(),
    });
  }

  /**
   * Clears runtime testing artifacts.
   */
  public static reset(): void {
    ProfileLoader.clear();
    ProfileStore.clear();
    ProfileRecoveryManager.clear();
  }
}

export default ProfileTesting;