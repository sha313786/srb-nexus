/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : loader.ts
 * Purpose : Configuration profile loader.
 * =========================================================
 */

import {
  ProfileRegistry,
  type ProfileDefinition,
} from "./registry.js";

/**
 * Configuration profile loader.
 */
export class ProfileLoader {
  /**
   * Loaded profiles.
   */
  private static readonly loaded = new Set<string>();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a profile.
   *
   * @param id Profile identifier.
   *
   * @returns Loaded profile.
   */
  public static load(
    id: string,
  ): ProfileDefinition {
    const profile =
      ProfileRegistry.resolve(id);

    ProfileLoader.loaded.add(id);

    return profile;
  }

  /**
   * Unloads a profile.
   *
   * @param id Profile identifier.
   *
   * @returns True if unloaded.
   */
  public static unload(
    id: string,
  ): boolean {
    return ProfileLoader.loaded.delete(id);
  }

  /**
   * Determines whether a profile is loaded.
   *
   * @param id Profile identifier.
   *
   * @returns True if loaded.
   */
  public static isLoaded(
    id: string,
  ): boolean {
    return ProfileLoader.loaded.has(id);
  }

  /**
   * Returns every loaded profile.
   *
   * @returns Loaded profiles.
   */
  public static getLoaded(): readonly ProfileDefinition[] {
    return Object.freeze(
      ProfileRegistry
        .getAll()
        .filter((profile) =>
          ProfileLoader.loaded.has(profile.id),
        ),
    );
  }

  /**
   * Clears every loaded profile.
   */
  public static clear(): void {
    ProfileLoader.loaded.clear();
  }
}

export default ProfileLoader;