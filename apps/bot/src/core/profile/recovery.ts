/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Configuration profile recovery manager.
 * =========================================================
 */

import { ProfileManager } from "./manager.js";

/**
 * Represents a failed profile operation.
 */
export interface FailedProfile {
  /**
   * Profile identifier.
   */
  readonly profile: string;

  /**
   * Failure timestamp.
   */
  readonly timestamp: Date;

  /**
   * Failure reason.
   */
  readonly error: Error;
}

/**
 * Configuration profile recovery manager.
 */
export class ProfileRecoveryManager {
  /**
   * Failed profile operations.
   */
  private static readonly failures: FailedProfile[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a failed profile operation.
   *
   * @param profile Profile identifier.
   * @param error Failure reason.
   */
  public static record(
    profile: string,
    error: Error,
  ): void {
    ProfileRecoveryManager.failures.push({
      profile,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Retries every failed profile load.
   */
  public static retryAll(): void {
    const failures = [
      ...ProfileRecoveryManager.failures,
    ];

    ProfileRecoveryManager.failures.length = 0;

    for (const failure of failures) {
      try {
        ProfileManager.load(
          failure.profile,
        );
      } catch (error) {
        ProfileRecoveryManager.record(
          failure.profile,
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Returns every failed profile.
   *
   * @returns Failed profiles.
   */
  public static getAll(): readonly FailedProfile[] {
    return Object.freeze([
      ...ProfileRecoveryManager.failures,
    ]);
  }

  /**
   * Returns the number of failures.
   *
   * @returns Failure count.
   */
  public static count(): number {
    return ProfileRecoveryManager.failures.length;
  }

  /**
   * Clears every recorded failure.
   */
  public static clear(): void {
    ProfileRecoveryManager.failures.length = 0;
  }
}

export default ProfileRecoveryManager;