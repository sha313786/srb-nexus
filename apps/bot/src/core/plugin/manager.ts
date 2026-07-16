/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Centralized plugin manager.
 * =========================================================
 */

import { PluginLifecycleManager } from "./lifecycle.js";
import { PluginLoader } from "./loader.js";
import { PluginValidation } from "./validation.js";

/**
 * High-level plugin management API.
 */
export class PluginManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a plugin.
   *
   * @param id Plugin identifier.
   */
  public static load(
    id: string,
  ): void {
    PluginLifecycleManager.load(id);
  }

  /**
   * Unloads a plugin.
   *
   * @param id Plugin identifier.
   */
  public static unload(
    id: string,
  ): void {
    PluginLifecycleManager.unload(id);
  }

  /**
   * Determines whether a plugin exists.
   *
   * @param id Plugin identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return PluginValidation.validate(id);
  }

  /**
   * Determines whether a plugin is loaded.
   *
   * @param id Plugin identifier.
   *
   * @returns True if loaded.
   */
  public static isLoaded(
    id: string,
  ): boolean {
    return PluginLoader.isLoaded(id);
  }

  /**
   * Loads every registered plugin.
   */
  public static loadAll(): void {
    for (const plugin of PluginLoader.getLoaded()) {
      PluginLifecycleManager.load(plugin.id);
    }
  }

  /**
   * Unloads every loaded plugin.
   */
  public static unloadAll(): void {
    for (const plugin of PluginLoader.getLoaded()) {
      PluginLifecycleManager.unload(plugin.id);
    }
  }

  /**
   * Clears every loaded plugin.
   */
  public static clear(): void {
    PluginLoader.clear();
    PluginLifecycleManager.clear();
  }
}

export default PluginManager;