/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : handler.ts
 * Purpose : Command handler manager.
 * =========================================================
 */

import {
  CommandDispatcher,
  type CommandHandler,
} from "./dispatcher.js";

/**
 * Centralized command handler manager.
 *
 * Provides a unified interface for registering
 * and removing command handlers.
 */
export class CommandHandlerManager {
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
    CommandDispatcher.register(
      id,
      handler,
    );
  }

  /**
   * Determines whether a command handler exists.
   *
   * @param id Command identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return CommandDispatcher.has(id);
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
    return CommandDispatcher.remove(id);
  }

  /**
   * Removes every registered command handler.
   */
  public static clear(): void {
    CommandDispatcher.clear();
  }
}

export default CommandHandlerManager;