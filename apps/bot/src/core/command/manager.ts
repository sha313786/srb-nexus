/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Centralized command manager.
 * =========================================================
 */

import {
  CommandHandler,
  CommandDispatcher,
} from "./dispatcher.js";

import { CommandExecution } from "./execution.js";
import { CommandHandlerManager } from "./handler.js";
import { CommandValidation } from "./validation.js";

/**
 * High-level command management API.
 *
 * Provides a unified entry point for working
 * with the command framework.
 */
export class CommandManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers a command handler.
   *
   * @param id Command identifier.
   * @param handler Command callback.
   */
  public static register<T>(
    id: string,
    handler: CommandHandler<T>,
  ): void {
    CommandHandlerManager.register(
      id,
      handler,
    );
  }

  /**
   * Executes a command.
   *
   * @param id Command identifier.
   * @param context Command context.
   */
  public static async execute<T>(
    id: string,
    context: T,
  ): Promise<void> {
    await CommandExecution.execute(
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
    return CommandExecution.canExecute(id);
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
    return CommandValidation.validate(id);
  }

  /**
   * Removes a command handler.
   *
   * @param id Command identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return CommandHandlerManager.remove(id);
  }

  /**
   * Clears every registered command handler.
   */
  public static clear(): void {
    CommandDispatcher.clear();
  }
}

export default CommandManager;