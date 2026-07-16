/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : pipeline.ts
 * Purpose : Command execution pipeline.
 * =========================================================
 */

import {
  CommandContext,
} from "./context.js";

import { CommandExecution } from "./execution.js";
import { CommandMiddlewareManager } from "./middleware.js";

/**
 * Centralized command execution pipeline.
 *
 * Executes middleware before the command handler.
 */
export class CommandPipeline {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Executes the complete command pipeline.
   *
   * Order:
   * 1. Middleware
   * 2. Command Handler
   *
   * @param context Command context.
   */
  public static async execute<T>(
    context: Readonly<CommandContext<T>>,
  ): Promise<void> {
    await CommandMiddlewareManager.execute(
      context,
    );

    await CommandExecution.execute(
      context.command,
      context.payload,
    );
  }
}

export default CommandPipeline;