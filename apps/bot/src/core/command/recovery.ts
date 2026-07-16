/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Command recovery manager.
 * =========================================================
 */

import { CommandExecution } from "./execution.js";

/**
 * Represents a failed command execution.
 */
export interface FailedCommand<T = unknown> {
  /**
   * Command identifier.
   */
  readonly command: string;

  /**
   * Command payload.
   */
  readonly payload: T;

  /**
   * Failure timestamp.
   */
  readonly timestamp: Date;

  /**
   * Failure reason.
   */
  readonly error: Error;
}

/**
 * Command recovery manager.
 */
export class CommandRecoveryManager {
  /**
   * Failed command executions.
   */
  private static readonly failedCommands: FailedCommand[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a failed command.
   *
   * @param command Command identifier.
   * @param payload Command payload.
   * @param error Failure reason.
   */
  public static record<T>(
    command: string,
    payload: T,
    error: Error,
  ): void {
    CommandRecoveryManager.failedCommands.push({
      command,
      payload,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Retries every failed command.
   */
  public static async retryAll(): Promise<void> {
    const failed = [
      ...CommandRecoveryManager.failedCommands,
    ];

    CommandRecoveryManager.failedCommands.length = 0;

    for (const entry of failed) {
      try {
        await CommandExecution.execute(
          entry.command,
          entry.payload,
        );
      } catch (error) {
        CommandRecoveryManager.record(
          entry.command,
          entry.payload,
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Returns every failed command.
   *
   * @returns Failed commands.
   */
  public static getAll(): readonly FailedCommand[] {
    return Object.freeze([
      ...CommandRecoveryManager.failedCommands,
    ]);
  }

  /**
   * Returns the number of failed commands.
   *
   * @returns Failure count.
   */
  public static count(): number {
    return CommandRecoveryManager.failedCommands.length;
  }

  /**
   * Clears all failed commands.
   */
  public static clear(): void {
    CommandRecoveryManager.failedCommands.length = 0;
  }
}

export default CommandRecoveryManager;