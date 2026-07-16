/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : environment.ts
 * Purpose : Environment profile management.
 * =========================================================
 */

import {
  ProfileRegistry,
  type ProfileDefinition,
} from "./registry.js";

/**
 * Supported runtime environments.
 */
export enum EnvironmentProfile {
  DEVELOPMENT = "development",
  TEST = "test",
  STAGING = "staging",
  PRODUCTION = "production",
}

/**
 * Environment profile manager.
 */
export class EnvironmentProfileManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a profile by environment.
   *
   * @param environment Environment name.
   *
   * @returns Matching profile or undefined.
   */
  public static resolve(
    environment: EnvironmentProfile | string,
  ): ProfileDefinition | undefined {
    return ProfileRegistry
      .getAll()
      .find(
        (profile) =>
          profile.environment === environment,
      );
  }

  /**
   * Determines whether an environment
   * profile exists.
   *
   * @param environment Environment name.
   *
   * @returns True if found.
   */
  public static has(
    environment: EnvironmentProfile | string,
  ): boolean {
    return (
      EnvironmentProfileManager.resolve(
        environment,
      ) !== undefined
    );
  }

  /**
   * Returns every registered environment.
   *
   * @returns Environment names.
   */
  public static getEnvironments(): readonly string[] {
    return Object.freeze([
      ...new Set(
        ProfileRegistry
          .getAll()
          .map(
            (profile) =>
              profile.environment,
          ),
      ),
    ]);
  }
}

export default EnvironmentProfileManager;