/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : queue.ts
 * Purpose : Asynchronous event queue.
 * =========================================================
 */

import { EventEmitter } from "./emitter.js";

/**
 * Represents a queued event.
 */
export interface QueuedEvent<T = unknown> {
  /**
   * Event identifier.
   */
  readonly event: string;

  /**
   * Event payload.
   */
  readonly payload: T;
}

/**
 * Centralized asynchronous event queue.
 *
 * Events are processed sequentially to preserve
 * execution order.
 */
export class AsyncEventQueue {
  /**
   * Pending events.
   */
  private static readonly queue: QueuedEvent[] = [];

  /**
   * Indicates whether processing is active.
   */
  private static processing = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Enqueues an event.
   *
   * @param event Event identifier.
   * @param payload Event payload.
   */
  public static async enqueue<T>(
    event: string,
    payload: T,
  ): Promise<void> {
    AsyncEventQueue.queue.push({
      event,
      payload,
    });

    await AsyncEventQueue.process();
  }

  /**
   * Processes queued events.
   */
  private static async process(): Promise<void> {
    if (AsyncEventQueue.processing) {
      return;
    }

    AsyncEventQueue.processing = true;

    try {
      while (AsyncEventQueue.queue.length > 0) {
        const next = AsyncEventQueue.queue.shift();

        if (!next) {
          continue;
        }

        await EventEmitter.emit(
          next.event,
          next.payload,
        );
      }
    } finally {
      AsyncEventQueue.processing = false;
    }
  }

  /**
   * Returns the number of queued events.
   *
   * @returns Queue size.
   */
  public static size(): number {
    return AsyncEventQueue.queue.length;
  }

  /**
   * Determines whether processing is active.
   *
   * @returns Processing status.
   */
  public static isProcessing(): boolean {
    return AsyncEventQueue.processing;
  }

  /**
   * Clears all queued events.
   */
  public static clear(): void {
    AsyncEventQueue.queue.length = 0;
  }
}

export default AsyncEventQueue;