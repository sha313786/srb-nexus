/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Plugin execution context.
 * =========================================================
 */

import type { PluginDefinition } from "./registry.js";

/**
 * Represents the execution context of a plugin.
 */
export interface PluginContext {
  /**
   * Plugin definition.
   */
  readonly plugin: PluginDefinition;

  /**
   * Context creation timestamp.
   */
  readonly createdAt: Date;

  /**
   * Indicates whether the plugin is currently active.
   */
  readonly active: boolean;
}

/**
 * Factory responsible for creating immutable plugin contexts.
 */
export class PluginContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a plugin context.
   *
   * @param plugin Plugin definition.
   * @param active Plugin active state.
   *
   * @returns Immutable plugin context.
   */
  public static create(
    plugin: PluginDefinition,
    active = true,
  ): Readonly<PluginContext> {
    return Object.freeze({
      plugin,
      createdAt: new Date(),
      active,
    });
  }
}

export default PluginContextFactory;