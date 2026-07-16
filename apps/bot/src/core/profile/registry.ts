/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized configuration profile registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Configuration profile definition.
 */
export interface ProfileDefinition {
  /**
   * Unique profile identifier.
   */
  readonly id: string;

  /**
   * Profile name.
   */
  readonly name: string;

  /**
   * Profile description.
   */
  readonly description: string;

  /**
   * Environment name.
   */
  readonly environment: string;
}

/**
 * Centralized configuration profile registry.
 */
export class ProfileRegistry {
  /**
   * Registered profiles.
   */
  private static readonly profiles = new Map<
    string,
    ProfileDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a profile.
   *
   * @param profile Profile definition.
   */
  public static register(
    profile: ProfileDefinition,
  ): void {
    if (ProfileRegistry.profiles.has(profile.id)) {
      throw new ConfigurationError(
        `Profile "${profile.id}" is already registered.`,
      );
    }

    ProfileRegistry.profiles.set(
      profile.id,
      profile,
    );
  }

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
    const profile =
      ProfileRegistry.profiles.get(id);

    if (!profile) {
      throw new ConfigurationError(
        `Profile "${id}" is not registered.`,
      );
    }

    return profile;
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
    return ProfileRegistry.profiles.has(id);
  }

  /**
   * Returns every registered profile.
   *
   * @returns Registered profiles.
   */
  public static getAll(): readonly ProfileDefinition[] {
    return Object.freeze([
      ...ProfileRegistry.profiles.values(),
    ]);
  }

  /**
   * Removes a profile.
   *
   * @param id Profile identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return ProfileRegistry.profiles.delete(id);
  }

  /**
   * Clears every registered profile.
   */
  public static clear(): void {
    ProfileRegistry.profiles.clear();
  }
}

export default ProfileRegistry;