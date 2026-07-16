/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : execution.ts
 * Purpose : Command execution service.
 * =========================================================
 */

import { CommandDispatcher } from "./dispatcher.js";
import { CommandValidation } from "./validation.js";

/**
 * Centralized command execution service.
 */
export class CommandExecution {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes a command.
   *
   * @param id Command identifier.
   * @param context Command execution context.
   */
  public static async execute<T>(
    id: string,
    context: T,
  ): Promise<void> {
    if (!CommandValidation.validate(id)) {
      throw new Error(
        `Unknown command: "${id}".`,
      );
    }

    await CommandDispatcher.dispatch(
      id,
      context,
    );
  }

  /**
   * Determines whether a command
   * can be executed.
   *
   * @param id Command identifier.
   *
   * @returns True if executable.
   */
  public static canExecute(
    id: string,
  ): boolean {
    return CommandValidation.validate(id) &&
      CommandDispatcher.has(id);
  }
}

export default CommandExecution;