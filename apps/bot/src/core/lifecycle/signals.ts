/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : signals.ts
 * Purpose : Process signal registration.
 * =========================================================
 */

import { ShutdownPipeline } from "./shutdown.js";

/**
 * Registers operating system signal handlers.
 *
 * Supported signals:
 * - SIGINT
 * - SIGTERM
 */
export class ProcessSignalHandler {
  /**
   * Indicates whether signal handlers
   * have already been registered.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers application signal handlers.
   */
  public static register(): void {
    if (ProcessSignalHandler.registered) {
      return;
    }

    const shutdown = async (): Promise<void> => {
      await ShutdownPipeline.stop();
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);

    ProcessSignalHandler.registered = true;
  }

  /**
   * Indicates whether handlers have
   * been registered.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return ProcessSignalHandler.registered;
  }
}

export default ProcessSignalHandler;