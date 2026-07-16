/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : monitor.ts
 * Purpose : Configuration profile monitoring utilities.
 * =========================================================
 */

import { ProfileHealth } from "./health.js";
import { ProfileLoader } from "./loader.js";
import { ProfileRecoveryManager } from "./recovery.js";
import { ProfileStore } from "./store.js";

/**
 * Configuration profile monitoring utilities.
 */
export class ProfileMonitor {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Returns the total number of loaded profiles.
   *
   * @returns Loaded profile count.
   */
  public static loadedProfiles(): number {
    return ProfileLoader.getLoaded().length;
  }

  /**
   * Returns the total number of stored profiles.
   *
   * @returns Stored profile count.
   */
  public static storedProfiles(): number {
    return ProfileStore.getAll().length;
  }

  /**
   * Returns the number of failed profile operations.
   *
   * @returns Failure count.
   */
  public static failedProfiles(): number {
    return ProfileRecoveryManager.count();
  }

  /**
   * Determines whether the framework is healthy.
   *
   * @returns True if healthy.
   */
  public static isHealthy(): boolean {
    return ProfileHealth.isHealthy();
  }

  /**
   * Returns a monitoring snapshot.
   *
   * @returns Current framework state.
   */
  public static snapshot(): Readonly<{
    loadedProfiles: number;
    storedProfiles: number;
    failedProfiles: number;
    healthy: boolean;
    timestamp: Date;
  }> {
    return Object.freeze({
      loadedProfiles:
        ProfileMonitor.loadedProfiles(),

      storedProfiles:
        ProfileMonitor.storedProfiles(),

      failedProfiles:
        ProfileMonitor.failedProfiles(),

      healthy:
        ProfileMonitor.isHealthy(),

      timestamp: new Date(),
    });
  }
}

export default ProfileMonitor;
