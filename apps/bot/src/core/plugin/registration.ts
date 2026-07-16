/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default framework plugin registration.
 * =========================================================
 */

import {
  PluginRegistry,
  type PluginDefinition,
} from "./registry.js";

/**
 * Registers the default SRB NEXUS framework plugins.
 */
export class PluginRegistration {
  /**
   * Indicates whether registration has completed.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers every built-in framework plugin.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (PluginRegistration.registered) {
      return;
    }

    const plugins: readonly PluginDefinition[] = [
      {
        id: "core.framework",
        name: "Core Framework",
        version: "1.0.0",
        description:
          "Provides the SRB NEXUS core framework services.",
        author: "SRB Studios",
      },
      {
        id: "core.system",
        name: "System Plugin",
        version: "1.0.0",
        description:
          "Provides internal system functionality.",
        author: "SRB Studios",
      },
    ];

    for (const plugin of plugins) {
      if (!PluginRegistry.has(plugin.id)) {
        PluginRegistry.register(plugin);
      }
    }

    PluginRegistration.registered = true;
  }

  /**
   * Indicates whether registration has completed.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return PluginRegistration.registered;
  }
}

export default PluginRegistration;