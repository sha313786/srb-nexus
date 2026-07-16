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

export { EventDispatcher } from "./dispatcher.js";
export { EventEmitter } from "./emitter.js";
export { EventListener } from "./listener.js";
export { EventRegistry } from "./registry.js";
export { EventRegistration } from "./registration.js";
export { EventResolver } from "./resolver.js";
export { EventValidation } from "./validation.js";
export { EventManager } from "./manager.js";
export { EventContextFactory } from "./context.js";
export { EventMiddlewareManager } from "./middleware.js";
export {
  EventPriority,
  EventPriorityManager,
} from "./priority.js";
export { AsyncEventQueue } from "./queue.js";
export { EventMetricsManager } from "./metrics.js";
export { EventMonitor } from "./monitor.js";
export { EventRecoveryManager } from "./recovery.js";
export { EventTesting } from "./testing.js";

export type { EventDefinition } from "./registry.js";
export type { EventHandler } from "./dispatcher.js";
export type { EventContext } from "./context.js";
export type { EventMiddleware } from "./middleware.js";
export type { PrioritizedEventHandler } from "./priority.js";
export type { QueuedEvent } from "./queue.js";
export type { EventMetrics } from "./metrics.js";
export type { FailedEvent } from "./recovery.js";
export type { EventFrameworkReport } from "./testing.js";