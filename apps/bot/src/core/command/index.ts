/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the command framework.
 * =========================================================
 */

export { CommandRegistry } from "./registry.js";
export { CommandRegistration } from "./registration.js";
export { CommandResolver } from "./resolver.js";
export { CommandValidation } from "./validation.js";
export { CommandDispatcher } from "./dispatcher.js";
export { CommandHandlerManager } from "./handler.js";
export { CommandExecution } from "./execution.js";
export { CommandManager } from "./manager.js";
export { CommandContextFactory } from "./context.js";
export { CommandMiddlewareManager } from "./middleware.js";
export { CommandPipeline } from "./pipeline.js";
export { CommandMetricsManager } from "./metrics.js";
export { CommandMonitor } from "./monitor.js";
export { CommandRecoveryManager } from "./recovery.js";
export { CommandTesting } from "./testing.js";
export { CommandHealth } from "./health.js";

export type { CommandDefinition } from "./registry.js";
export type { CommandHandler } from "./dispatcher.js";
export type { CommandContext } from "./context.js";
export type { CommandMiddleware } from "./middleware.js";
export type { CommandMetrics } from "./metrics.js";
export type { FailedCommand } from "./recovery.js";
export type { CommandFrameworkReport } from "./testing.js";
export type { CommandHealthReport } from "./health.js";