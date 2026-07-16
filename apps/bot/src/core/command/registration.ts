/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default framework command registration.
 * =========================================================
 */

import {
  CommandRegistry,
  type CommandDefinition,
} from "./registry.js";

/**
 * Registers the default SRB NEXUS framework commands.
 */
export class CommandRegistration {
  /**
   * Indicates whether registration has completed.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers all built-in framework commands.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (CommandRegistration.registered) {
      return;
    }

    const commands: readonly CommandDefinition[] = [
      {
        id: "system.help",
        name: "help",
        description:
          "Displays available framework commands.",
      },
      {
        id: "system.version",
        name: "version",
        description:
          "Displays the current framework version.",
      },
    ];

    for (const command of commands) {
      if (!CommandRegistry.has(command.id)) {
        CommandRegistry.register(command);
      }
    }

    CommandRegistration.registered = true;
  }

  /**
   * Indicates whether registration has completed.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return CommandRegistration.registered;
  }
}

export default CommandRegistration;