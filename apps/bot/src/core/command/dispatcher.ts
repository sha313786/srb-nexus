/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : dispatcher.ts
 * Purpose : Centralized command dispatcher.
 * =========================================================
 */

import { CommandResolver } from "./resolver.js";

/**
 * Command execution callback.
 */
export type CommandHandler<T = unknown> = (
  context: T,
) => void | Promise<void>;

/**
 * Centralized command dispatcher.
 *
 * Responsible for dispatching registered
 * commands to their handlers.
 */
export class CommandDispatcher {
  /**
   * Registered command handlers.
   */
  private static readonly handlers = new Map<
    string,
    CommandHandler
  >();

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
    CommandDispatcher.handlers.set(
      id,
      handler as CommandHandler,
    );
  }

  /**
   * Executes a registered command.
   *
   * @param id Command identifier.
   * @param context Command context.
   */
  public static async dispatch<T>(
    id: string,
    context: T,
  ): Promise<void> {
    CommandResolver.resolve(id);

    const handler =
      CommandDispatcher.handlers.get(id);

    if (!handler) {
      return;
    }

    await handler(context);
  }

  /**
   * Determines whether a handler exists.
   *
   * @param id Command identifier.
   *
   * @returns True if registered.
   */
  public static has(
    id: string,
  ): boolean {
    return CommandDispatcher.handlers.has(id);
  }

  /**
   * Removes a handler.
   *
   * @param id Command identifier.
   *
   * @returns True if removed.
   */
  public static remove(
    id: string,
  ): boolean {
    return CommandDispatcher.handlers.delete(id);
  }

  /**
   * Clears every registered handler.
   */
  public static clear(): void {
    CommandDispatcher.handlers.clear();
  }
}

export default CommandDispatcher;