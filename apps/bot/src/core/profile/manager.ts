/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Centralized profile manager.
 * =========================================================
 */

import { ProfileLoader } from "./loader.js";
import { ProfileValidation } from "./validation.js";

/**
 * High-level configuration profile manager.
 */
export class ProfileManager {
  /**
   * Active profile identifier.
   */
  private static activeProfile?: string;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads and activates a profile.
   *
   * @param id Profile identifier.
   */
  public static load(
    id: string,
  ): void {
    ProfileLoader.load(id);
    ProfileManager.activeProfile = id;
  }

  /**
   * Unloads a profile.
   *
   * @param id Profile identifier.
   */
  public static unload(
    id: string,
  ): void {
    ProfileLoader.unload(id);

    if (ProfileManager.activeProfile === id) {
      ProfileManager.activeProfile = undefined;
    }
  }

  /**
   * Determines whether a profile exists.
   *
   * @param id Profile identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return ProfileValidation.validate(id);
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
    return ProfileLoader.isLoaded(id);
  }

  /**
   * Returns the active profile identifier.
   *
   * @returns Active profile or undefined.
   */
  public static getActive():
    | string
    | undefined {
    return ProfileManager.activeProfile;
  }

  /**
   * Clears all loaded profiles.
   */
  public static clear(): void {
    ProfileLoader.clear();
    ProfileManager.activeProfile = undefined;
  }
}

export default ProfileManager;