/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : events.ts
 * Purpose : Configuration profile lifecycle events.
 * =========================================================
 */

import { EventEmitter } from "../event/index.js";

/**
 * Profile framework event names.
 */
export enum ProfileEvent {
  LOADED = "profile.loaded",
  UNLOADED = "profile.unloaded",
  REGISTERED = "profile.registered",
  UNREGISTERED = "profile.unregistered",
  UPDATED = "profile.updated",
}

/**
 * Profile event payload.
 */
export interface ProfileEventPayload {
  /**
   * Profile identifier.
   */
  readonly profile: string;

  /**
   * Event timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Centralized profile event manager.
 */
export class ProfileEventManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Emits a profile event.
   *
   * @param event Profile event.
   * @param profile Profile identifier.
   */
  public static async emit(
    event: ProfileEvent,
    profile: string,
  ): Promise<void> {
    await EventEmitter.emit(event, {
      profile,
      timestamp: new Date(),
    } satisfies ProfileEventPayload);
  }

  /**
   * Emits a profile loaded event.
   */
  public static async loaded(
    profile: string,
  ): Promise<void> {
    await ProfileEventManager.emit(
      ProfileEvent.LOADED,
      profile,
    );
  }

  /**
   * Emits a profile unloaded event.
   */
  public static async unloaded(
    profile: string,
  ): Promise<void> {
    await ProfileEventManager.emit(
      ProfileEvent.UNLOADED,
      profile,
    );
  }

  /**
   * Emits a profile registered event.
   */
  public static async registered(
    profile: string,
  ): Promise<void> {
    await ProfileEventManager.emit(
      ProfileEvent.REGISTERED,
      profile,
    );
  }

  /**
   * Emits a profile unregistered event.
   */
  public static async unregistered(
    profile: string,
  ): Promise<void> {
    await ProfileEventManager.emit(
      ProfileEvent.UNREGISTERED,
      profile,
    );
  }

  /**
   * Emits a profile updated event.
   */
  public static async updated(
    profile: string,
  ): Promise<void> {
    await ProfileEventManager.emit(
      ProfileEvent.UPDATED,
      profile,
    );
  }
}

export default ProfileEventManager;
