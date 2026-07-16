/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : override.ts
 * Purpose : Configuration profile override manager.
 * =========================================================
 */

import type { ProfileDefinition } from "./registry.js";

/**
 * Profile override values.
 */
export interface ProfileOverride {
  /**
   * Profile identifier.
   */
  readonly profile: string;

  /**
   * Override values.
   */
  readonly values: Partial<ProfileDefinition>;
}

/**
 * Configuration profile override manager.
 */
export class ProfileOverrideManager {
  /**
   * Registered overrides.
   */
  private static readonly overrides = new Map<
    string,
    Partial<ProfileDefinition>
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers profile overrides.
   *
   * @param profile Profile identifier.
   * @param values Override values.
   */
  public static register(
    profile: string,
    values: Partial<ProfileDefinition>,
  ): void {
    ProfileOverrideManager.overrides.set(
      profile,
      Object.freeze({
        ...values,
      }),
    );
  }

  /**
   * Returns override values.
   *
   * @param profile Profile identifier.
   *
   * @returns Override values.
   */
  public static get(
    profile: string,
  ): Partial<ProfileDefinition> {
    return (
      ProfileOverrideManager.overrides.get(
        profile,
      ) ?? {}
    );
  }

  /**
   * Determines whether a profile has overrides.
   *
   * @param profile Profile identifier.
   *
   * @returns True if overrides exist.
   */
  public static has(
    profile: string,
  ): boolean {
    return ProfileOverrideManager.overrides.has(
      profile,
    );
  }

  /**
   * Removes overrides.
   *
   * @param profile Profile identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    profile: string,
  ): boolean {
    return ProfileOverrideManager.overrides.delete(
      profile,
    );
  }

  /**
   * Returns every registered override.
   *
   * @returns Registered overrides.
   */
  public static getAll(): ReadonlyMap<
    string,
    Partial<ProfileDefinition>
  > {
    return ProfileOverrideManager.overrides;
  }

  /**
   * Clears every registered override.
   */
  public static clear(): void {
    ProfileOverrideManager.overrides.clear();
  }
}

export default ProfileOverrideManager;