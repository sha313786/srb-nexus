/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : events.ts
 * Purpose : Plugin lifecycle events.
 * =========================================================
 */

import { EventEmitter } from "../event/index.js";

/**
 * Plugin framework event names.
 */
export enum PluginEvent {
  LOADED = "plugin.loaded",
  UNLOADED = "plugin.unloaded",
  REGISTERED = "plugin.registered",
  UNREGISTERED = "plugin.unregistered",
}

/**
 * Plugin event payload.
 */
export interface PluginEventPayload {
  /**
   * Plugin identifier.
   */
  readonly plugin: string;

  /**
   * Event timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Centralized plugin event manager.
 */
export class PluginEventManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Emits a plugin event.
   *
   * @param event Plugin event.
   * @param plugin Plugin identifier.
   */
  public static async emit(
    event: PluginEvent,
    plugin: string,
  ): Promise<void> {
    await EventEmitter.emit(event, {
      plugin,
      timestamp: new Date(),
    } satisfies PluginEventPayload);
  }

  /**
   * Emits a plugin loaded event.
   *
   * @param plugin Plugin identifier.
   */
  public static async loaded(
    plugin: string,
  ): Promise<void> {
    await PluginEventManager.emit(
      PluginEvent.LOADED,
      plugin,
    );
  }

  /**
   * Emits a plugin unloaded event.
   *
   * @param plugin Plugin identifier.
   */
  public static async unloaded(
    plugin: string,
  ): Promise<void> {
    await PluginEventManager.emit(
      PluginEvent.UNLOADED,
      plugin,
    );
  }

  /**
   * Emits a plugin registered event.
   *
   * @param plugin Plugin identifier.
   */
  public static async registered(
    plugin: string,
  ): Promise<void> {
    await PluginEventManager.emit(
      PluginEvent.REGISTERED,
      plugin,
    );
  }

  /**
   * Emits a plugin unregistered event.
   *
   * @param plugin Plugin identifier.
   */
  public static async unregistered(
    plugin: string,
  ): Promise<void> {
    await PluginEventManager.emit(
      PluginEvent.UNREGISTERED,
      plugin,
    );
  }
}

export default PluginEventManager;