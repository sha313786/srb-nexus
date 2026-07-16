/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : context.ts
 * Purpose : Command execution context.
 * =========================================================
 */

/**
 * Represents the execution context of a command.
 */
export interface CommandContext<T = unknown> {
  /**
   * Command identifier.
   */
  readonly command: string;

  /**
   * Command payload.
   */
  readonly payload: T;

  /**
   * Execution timestamp.
   */
  readonly timestamp: Date;
}

/**
 * Creates immutable command contexts.
 */
export class CommandContextFactory {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Creates a command context.
   *
   * @param command Command identifier.
   * @param payload Command payload.
   *
   * @returns Immutable command context.
   */
  public static create<T>(
    command: string,
    payload: T,
  ): Readonly<CommandContext<T>> {
    return Object.freeze({
      command,
      payload,
      timestamp: new Date(),
    });
  }
}

export default CommandContextFactory;