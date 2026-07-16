/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default profile registration.
 * =========================================================
 */

import {
  ProfileRegistry,
  type ProfileDefinition,
} from "./registry.js";

/**
 * Registers the default configuration profiles.
 */
export class ProfileRegistration {
  /**
   * Indicates whether registration has completed.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers every built-in profile.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (ProfileRegistration.registered) {
      return;
    }

    const profiles: readonly ProfileDefinition[] = [
      {
        id: "development",
        name: "Development",
        description:
          "Configuration profile for local development.",
        environment: "development",
      },
      {
        id: "production",
        name: "Production",
        description:
          "Configuration profile for production deployment.",
        environment: "production",
      },
      {
        id: "testing",
        name: "Testing",
        description:
          "Configuration profile for automated testing.",
        environment: "test",
      },
    ];

    for (const profile of profiles) {
      if (!ProfileRegistry.has(profile.id)) {
        ProfileRegistry.register(profile);
      }
    }

    ProfileRegistration.registered = true;
  }

  /**
   * Indicates whether registration has completed.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return ProfileRegistration.registered;
  }
}

export default ProfileRegistration;