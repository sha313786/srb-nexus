/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : middleware.ts
 * Purpose : Event middleware pipeline.
 * =========================================================
 */

import type { EventContext } from "./context.js";

/**
 * Event middleware callback.
 */
export type EventMiddleware = (
  context: Readonly<EventContext>,
) => void | Promise<void>;

/**
 * Centralized event middleware pipeline.
 */
export class EventMiddlewareManager {
  /**
   * Registered middleware.
   */
  private static readonly middleware: EventMiddleware[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers middleware.
   *
   * @param middleware Middleware callback.
   */
  public static use(
    middleware: EventMiddleware,
  ): void {
    EventMiddlewareManager.middleware.push(
      middleware,
    );
  }

  /**
   * Executes registered middleware.
   *
   * @param context Event context.
   */
  public static async execute(
    context: Readonly<EventContext>,
  ): Promise<void> {
    for (const middleware of EventMiddlewareManager.middleware) {
      await middleware(context);
    }
  }

  /**
   * Returns registered middleware.
   *
   * @returns Middleware collection.
   */
  public static getAll(): readonly EventMiddleware[] {
    return Object.freeze([
      ...EventMiddlewareManager.middleware,
    ]);
  }

  /**
   * Clears registered middleware.
   */
  public static clear(): void {
    EventMiddlewareManager.middleware.length = 0;
  }
}

export default EventMiddlewareManager;