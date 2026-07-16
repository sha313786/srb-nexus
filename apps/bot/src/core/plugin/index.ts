/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Public exports for the plugin framework.
 * =========================================================
 */

export { PluginRegistry } from "./registry.js";
export { PluginRegistration } from "./registration.js";
export { PluginResolver } from "./resolver.js";
export { PluginValidation } from "./validation.js";
export { PluginLoader } from "./loader.js";

export {
  PluginLifecycleManager,
  PluginLifecycleState,
} from "./lifecycle.js";

export { PluginManager } from "./manager.js";
export { PluginContextFactory } from "./context.js";
export { PluginDependencyManager } from "./dependency.js";
export { PluginVersionManager } from "./version.js";
export { PluginLoadOrderManager } from "./load-order.js";

export {
  PluginEvent,
  PluginEventManager,
} from "./events.js";

export { PluginHealth } from "./health.js";
export { PluginRecoveryManager } from "./recovery.js";
export { PluginTesting } from "./testing.js";
export { PluginMonitor } from "./monitor.js";

export type { PluginDefinition } from "./registry.js";
export type { PluginLifecycle } from "./lifecycle.js";
export type { PluginContext } from "./context.js";
export type { PluginDependency } from "./dependency.js";
export type { PluginVersionRequirement } from "./version.js";
export type { PluginEventPayload } from "./events.js";
export type { PluginHealthReport } from "./health.js";
export type { FailedPlugin } from "./recovery.js";
export type { PluginFrameworkReport } from "./testing.js";