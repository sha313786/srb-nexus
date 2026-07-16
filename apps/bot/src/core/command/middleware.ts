/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : middleware.ts
 * Purpose : Command middleware pipeline.
 * =========================================================
 */

import type { CommandContext } from "./context.js";

/**
 * Command middleware callback.
 */
export type CommandMiddleware<T = unknown> = (
  context: Readonly<CommandContext<T>>,
) => void | Promise<void>;

/**
 * Centralized command middleware manager.
 *
 * Middleware executes before command handlers.
 */
export class CommandMiddlewareManager {
  /**
   * Registered middleware.
   */
  private static readonly middleware: CommandMiddleware[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers middleware.
   *
   * @param middleware Middleware callback.
   */
  public static use<T>(
    middleware: CommandMiddleware<T>,
  ): void {
    CommandMiddlewareManager.middleware.push(
      middleware as CommandMiddleware,
    );
  }

  /**
   * Executes registered middleware.
   *
   * @param context Command context.
   */
  public static async execute<T>(
    context: Readonly<CommandContext<T>>,
  ): Promise<void> {
    for (const middleware of CommandMiddlewareManager.middleware) {
      await middleware(context);
    }
  }

  /**
   * Returns registered middleware.
   *
   * @returns Middleware collection.
   */
  public static getAll(): readonly CommandMiddleware[] {
    return Object.freeze([
      ...CommandMiddlewareManager.middleware,
    ]);
  }

  /**
   * Clears registered middleware.
   */
  public static clear(): void {
    CommandMiddlewareManager.middleware.length = 0;
  }
}

export default CommandMiddlewareManager;