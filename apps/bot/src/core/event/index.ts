/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the event framework.
 * =========================================================
 */

/**
 * Event Dispatcher
 */
export {
  EventDispatcher,
} from "./dispatcher.js";

/**
 * Event Emitter
 */
export {
  EventEmitter,
} from "./emitter.js";

/**
 * Types
 */
export type {
  EventHandler,
} from "./dispatcher.js";
