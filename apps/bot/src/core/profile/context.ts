/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Configuration profile context.
 * =========================================================
 */

import type { ProfileDefinition } from "./registry.js";

/**
 * Represents the execution context of a profile.
 */
export interface ProfileContext {
  /**
   * Profile definition.
   */
  readonly profile: ProfileDefinition;

  /**
   * Context creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Indicates whether the profile is active.
   */
  readonly active: boolean;
}

/**
 * Factory responsible for creating immutable profile contexts.
 */
export class ProfileContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a profile context.
   *
   * @param profile Profile definition.
   * @param active Active state.
   *
   * @returns Immutable profile context.
   */
  public static create(
    profile: ProfileDefinition,
    active = true,
  ): Readonly<ProfileContext> {
    return Object.freeze({
      profile,
      createdAt: new Date(),
      active,
    });
  }
}

export default ProfileContextFactory;