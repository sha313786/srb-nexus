/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : resolver.ts
 * Purpose : Centralized command resolver.
 * =========================================================
 */

import {
  CommandRegistry,
  type CommandDefinition,
} from "./registry.js";

/**
 * Provides read-only access to registered commands.
 */
export class CommandResolver {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Resolves a command.
   *
   * @param id Command identifier.
   *
   * @returns Registered command.
   */
  public static resolve(
    id: string,
  ): CommandDefinition {
    return CommandRegistry.resolve(id);
  }

  /**
   * Determines whether a command exists.
   *
   * @param id Command identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return CommandRegistry.has(id);
  }

  /**
   * Returns every registered command.
   *
   * @returns Registered commands.
   */
  public static getAll(): readonly CommandDefinition[] {
    return CommandRegistry.getAll();
  }
}

export default CommandResolver;