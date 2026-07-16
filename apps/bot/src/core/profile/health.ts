/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : health.ts
 * Purpose : Configuration profile health service.
 * =========================================================
 */

import { ProfileRegistry } from "./registry.js";
import { ProfileLoader } from "./loader.js";
import { ProfileStore } from "./store.js";

/**
 * Represents the overall profile framework health.
 */
export interface ProfileHealthReport {
  /**
   * Overall framework health.
   */
  readonly healthy: boolean;

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
}

/**
 * Profile framework health service.
 */
export class ProfileHealth {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Generates a health report.
   *
   * @returns Health report.
   */
  public static report(): Readonly<ProfileHealthReport> {
    const registeredProfiles =
      ProfileRegistry.getAll().length;

    const loadedProfiles =
      ProfileLoader.getLoaded().length;

    const storedProfiles =
      ProfileStore.getAll().length;

    return Object.freeze({
      healthy:
        loadedProfiles <= registeredProfiles &&
        storedProfiles <= registeredProfiles,

      registeredProfiles,
      loadedProfiles,
      storedProfiles,
    });
  }

  /**
   * Determines whether the profile framework
   * is healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return ProfileHealth.report().healthy;
  }
}

export default ProfileHealth;