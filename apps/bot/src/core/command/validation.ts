/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : validation.ts
 * Purpose : Command validation utilities.
 * =========================================================
 */

import { CommandRegistry } from "./registry.js";

/**
 * Provides validation helpers for registered commands.
 */
export class CommandValidation {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Determines whether a command exists.
   *
   * @param id Command identifier.
   *
   * @returns True if the command exists.
   */
  public static validate(
    id: string,
  ): boolean {
    return CommandRegistry.has(id);
  }

  /**
   * Determines whether every supplied command exists.
   *
   * @param ids Command identifiers.
   *
   * @returns True if every command exists.
   */
  public static validateAll(
    ...ids: readonly string[]
  ): boolean {
    return ids.every((id) =>
      CommandRegistry.has(id),
    );
  }

  /**
   * Returns all missing commands.
   *
   * @param ids Command identifiers.
   *
   * @returns Missing command identifiers.
   */
  public static getMissing(
    ...ids: readonly string[]
  ): string[] {
    return ids.filter(
      (id) => !CommandRegistry.has(id),
    );
  }
}

export default CommandValidation;