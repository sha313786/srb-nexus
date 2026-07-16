/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : recovery.ts
 * Purpose : Event recovery manager.
 * =========================================================
 */

import { EventEmitter } from "./emitter.js";

/**
 * Represents a failed event.
 */
export interface FailedEvent<T = unknown> {
  /**
   * Event identifier.
   */
  readonly event: string;

  /**
   * Event payload.
   */
  readonly payload: T;

  /**
   * Failure timestamp.
   */
  readonly timestamp: Date;

  /**
   * Error that caused the failure.
   */
  readonly error: Error;
}

/**
 * Event recovery manager.
 *
 * Stores failed events and allows retrying them.
 */
export class EventRecoveryManager {
  /**
   * Failed events.
   */
  private static readonly failedEvents: FailedEvent[] = [];

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Records a failed event.
   *
   * @param event Event identifier.
   * @param payload Event payload.
   * @param error Failure reason.
   */
  public static record<T>(
    event: string,
    payload: T,
    error: Error,
  ): void {
    EventRecoveryManager.failedEvents.push({
      event,
      payload,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Retries every failed event.
   */
  public static async retryAll(): Promise<void> {
    const events = [
      ...EventRecoveryManager.failedEvents,
    ];

    EventRecoveryManager.failedEvents.length = 0;

    for (const failed of events) {
      try {
        await EventEmitter.emit(
          failed.event,
          failed.payload,
        );
      } catch (error) {
        EventRecoveryManager.record(
          failed.event,
          failed.payload,
          error instanceof Error
            ? error
            : new Error(String(error)),
        );
      }
    }
  }

  /**
   * Returns failed events.
   *
   * @returns Failed events.
   */
  public static getAll(): readonly FailedEvent[] {
    return Object.freeze([
      ...EventRecoveryManager.failedEvents,
    ]);
  }

  /**
   * Clears failed events.
   */
  public static clear(): void {
    EventRecoveryManager.failedEvents.length = 0;
  }

  /**
   * Returns the number of failed events.
   *
   * @returns Failure count.
   */
  public static count(): number {
    return EventRecoveryManager.failedEvents.length;
  }
}

export default EventRecoveryManager;