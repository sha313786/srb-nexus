/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : merge.ts
 * Purpose : Configuration profile merge utilities.
 * =========================================================
 */

import type { ProfileDefinition } from "./registry.js";

/**
 * Profile merge result.
 */
export interface ProfileMergeResult {
  /**
   * Base profile.
   */
  readonly base: ProfileDefinition;

  /**
   * Override profile.
   */
  readonly override: ProfileDefinition;

  /**
   * Merged profile.
   */
  readonly merged: ProfileDefinition;
}

/**
 * Configuration profile merge utilities.
 */
export class ProfileMerge {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Merges two profile definitions.
   *
   * Values from the override profile take precedence.
   *
   * @param base Base profile.
   * @param override Override profile.
   *
   * @returns Merge result.
   */
  public static merge(
    base: ProfileDefinition,
    override: ProfileDefinition,
  ): Readonly<ProfileMergeResult> {
    const merged: ProfileDefinition = {
      ...base,
      ...override,
      id: base.id,
    };

    return Object.freeze({
      base,
      override,
      merged: Object.freeze(merged),
    });
  }
}

export default ProfileMerge;
