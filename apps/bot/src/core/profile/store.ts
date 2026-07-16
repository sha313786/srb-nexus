/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : store.ts
 * Purpose : Configuration profile store.
 * =========================================================
 */

import type { ProfileDefinition } from "./registry.js";

/**
 * Centralized profile storage.
 */
export class ProfileStore {
  /**
   * Profile data storage.
   */
  private static readonly storage = new Map<
    string,
    ProfileDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Stores a profile.
   *
   * @param profile Profile definition.
   */
  public static save(
    profile: ProfileDefinition,
  ): void {
    ProfileStore.storage.set(
      profile.id,
      profile,
    );
  }

  /**
   * Retrieves a stored profile.
   *
   * @param id Profile identifier.
   *
   * @returns Stored profile.
   */
  public static get(
    id: string,
  ): ProfileDefinition | undefined {
    return ProfileStore.storage.get(id);
  }

  /**
   * Determines whether a profile exists.
   *
   * @param id Profile identifier.
   *
   * @returns True if stored.
   */
  public static has(
    id: string,
  ): boolean {
    return ProfileStore.storage.has(id);
  }

  /**
   * Returns every stored profile.
   *
   * @returns Stored profiles.
   */
  public static getAll(): readonly ProfileDefinition[] {
    return Object.freeze([
      ...ProfileStore.storage.values(),
    ]);
  }

  /**
   * Removes a stored profile.
   *
   * @param id Profile identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return ProfileStore.storage.delete(id);
  }

  /**
   * Clears every stored profile.
   */
  public static clear(): void {
    ProfileStore.storage.clear();
  }
}

export default ProfileStore;