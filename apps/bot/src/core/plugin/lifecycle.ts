/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : lifecycle.ts
 * Purpose : Plugin lifecycle management.
 * =========================================================
 */

import { PluginLoader } from "./loader.js";
import type { PluginDefinition } from "./registry.js";

/**
 * Supported plugin lifecycle states.
 */
export enum PluginLifecycleState {
  REGISTERED = "REGISTERED",
  LOADED = "LOADED",
  UNLOADED = "UNLOADED",
}

/**
 * Plugin lifecycle information.
 */
export interface PluginLifecycle {
  /**
   * Plugin definition.
   */
  readonly plugin: PluginDefinition;

  /**
   * Current lifecycle state.
   */
  state: PluginLifecycleState;

  /**
   * Last state change timestamp.
   */
  updatedAt: Date;
}

/**
 * Centralized plugin lifecycle manager.
 */
export class PluginLifecycleManager {
  /**
   * Lifecycle storage.
   */
  private static readonly lifecycles = new Map<
    string,
    PluginLifecycle
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Marks a plugin as loaded.
   *
   * @param id Plugin identifier.
   *
   * @returns Lifecycle information.
   */
  public static load(
    id: string,
  ): PluginLifecycle {
    const plugin = PluginLoader.load(id);

    const lifecycle: PluginLifecycle = {
      plugin,
      state: PluginLifecycleState.LOADED,
      updatedAt: new Date(),
    };

    PluginLifecycleManager.lifecycles.set(
      id,
      lifecycle,
    );

    return lifecycle;
  }

  /**
   * Marks a plugin as unloaded.
   *
   * @param id Plugin identifier.
   */
  public static unload(
    id: string,
  ): void {
    PluginLoader.unload(id);

    const lifecycle =
      PluginLifecycleManager.lifecycles.get(id);

    if (!lifecycle) {
      return;
    }

    lifecycle.state =
      PluginLifecycleState.UNLOADED;

    lifecycle.updatedAt = new Date();
  }

  /**
   * Returns lifecycle information.
   *
   * @param id Plugin identifier.
   *
   * @returns Lifecycle information.
   */
  public static get(
    id: string,
  ): PluginLifecycle | undefined {
    return PluginLifecycleManager.lifecycles.get(id);
  }

  /**
   * Returns every lifecycle.
   *
   * @returns Registered lifecycles.
   */
  public static getAll(): readonly PluginLifecycle[] {
    return Object.freeze([
      ...PluginLifecycleManager.lifecycles.values(),
    ]);
  }

  /**
   * Clears lifecycle information.
   */
  public static clear(): void {
    PluginLifecycleManager.lifecycles.clear();
  }
}

export default PluginLifecycleManager;