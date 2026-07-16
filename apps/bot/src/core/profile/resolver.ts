/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized profile resolver.
 * =========================================================
 */

import {
  ProfileRegistry,
  type ProfileDefinition,
} from "./registry.js";

/**
 * Provides read-only access to registered profiles.
 */
export class ProfileResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a profile.
   *
   * @param id Profile identifier.
   *
   * @returns Registered profile.
   */
  public static resolve(
    id: string,
  ): ProfileDefinition {
    return ProfileRegistry.resolve(id);
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
    return ProfileRegistry.has(id);
  }

  /**
   * Returns every registered profile.
   *
   * @returns Registered profiles.
   */
  public static getAll(): readonly ProfileDefinition[] {
    return ProfileRegistry.getAll();
  }
}

export default ProfileResolver;