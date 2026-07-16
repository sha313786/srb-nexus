/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registry.ts
 * Purpose : Centralized command registry.
 * =========================================================
 */

import { ConfigurationError } from "../error/index.js";

/**
 * Command definition.
 */
export interface CommandDefinition {
  /**
   * Unique command identifier.
   */
  readonly id: string;

  /**
   * Command name.
   */
  readonly name: string;

  /**
   * Command description.
   */
  readonly description: string;
}

/**
 * Centralized command registry.
 */
export class CommandRegistry {
  /**
   * Registered commands.
   */
  private static readonly commands = new Map<
    string,
    CommandDefinition
  >();

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a command.
   *
   * @param command Command definition.
   */
  public static register(
    command: CommandDefinition,
  ): void {
    if (CommandRegistry.commands.has(command.id)) {
      throw new ConfigurationError(
        `Command "${command.id}" is already registered.`,
      );
    }

    CommandRegistry.commands.set(
      command.id,
      command,
    );
  }

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
    const command =
      CommandRegistry.commands.get(id);

    if (!command) {
      throw new ConfigurationError(
        `Command "${id}" is not registered.`,
      );
    }

    return command;
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
    return CommandRegistry.commands.has(id);
  }

  /**
   * Returns all registered commands.
   *
   * @returns Registered commands.
   */
  public static getAll(): readonly CommandDefinition[] {
    return Object.freeze([
      ...CommandRegistry.commands.values(),
    ]);
  }

  /**
   * Removes a command.
   *
   * @param id Command identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return CommandRegistry.commands.delete(id);
  }

  /**
   * Clears all registered commands.
   */
  public static clear(): void {
    CommandRegistry.commands.clear();
  }
}

export default CommandRegistry;