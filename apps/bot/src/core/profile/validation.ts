/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Profile validation utilities.
 * =========================================================
 */

import { ProfileRegistry } from "./registry.js";

/**
 * Provides validation helpers for registered profiles.
 */
export class ProfileValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Determines whether a profile exists.
   *
   * @param id Profile identifier.
   *
   * @returns True if the profile exists.
   */
  public static validate(
    id: string,
  ): boolean {
    return ProfileRegistry.has(id);
  }

  /**
   * Determines whether every supplied profile exists.
   *
   * @param ids Profile identifiers.
   *
   * @returns True if every profile exists.
   */
  public static validateAll(
    ...ids: readonly string[]
  ): boolean {
    return ids.every((id) =>
      ProfileRegistry.has(id),
    );
  }

  /**
   * Returns missing profiles.
   *
   * @param ids Profile identifiers.
   *
   * @returns Missing profile identifiers.
   */
  public static getMissing(
    ...ids: readonly string[]
  ): string[] {
    return ids.filter(
      (id) => !ProfileRegistry.has(id),
    );
  }
}

export default ProfileValidation;