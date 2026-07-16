/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : registration.ts
 * Purpose : Default framework service registration.
 * =========================================================
 */

import { ServiceContainer } from "./container.js";

/**
 * Registers the default framework services.
 *
 * This class provides a single entry point for registering
 * framework services during application startup.
 *
 * External services such as Discord, Database, API,
 * Dashboard, Scheduler and AI will be added in
 * future milestones.
 */
export class ServiceRegistration {
  /**
   * Indicates whether default services have already
   * been registered.
   */
  private static registered = false;

  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Registers all default framework services.
   *
   * Safe to call multiple times.
   */
  public static registerDefaults(): void {
    if (ServiceRegistration.registered) {
      return;
    }

    /**
     * Register framework services here.
     *
     * Future examples:
     *
     * ServiceContainer.register("logger", logger);
     * ServiceContainer.register("discord", client);
     * ServiceContainer.register("database", database);
     * ServiceContainer.register("dashboard", dashboard);
     */

    ServiceRegistration.registered = true;
  }

  /**
   * Indicates whether the default services have been
   * registered.
   *
   * @returns Registration status.
   */
  public static isRegistered(): boolean {
    return ServiceRegistration.registered;
  }
}

export default ServiceRegistration;