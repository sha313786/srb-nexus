/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : manager.ts
 * Purpose : Service lifecycle manager.
 * =========================================================
 */

import { ServiceLoader } from "./loader.js";
import {
  ServiceDefinition,
  ServiceRegistry,
} from "./registry.js";

/**
 * Service lifecycle manager.
 */
export class ServiceManager {
  /**
   * Prevent instantiation.
   */
  private constructor() {}

  /**
   * Loads a service.
   *
   * @param id Service identifier.
   *
   * @returns Loaded service.
   */
  public static load(
    id: string,
  ): ServiceDefinition {
    return ServiceLoader.load(id);
  }

  /**
   * Loads every registered service.
   *
   * @returns Loaded services.
   */
  public static loadAll():
    readonly ServiceDefinition[] {
    return ServiceLoader.loadAll();
  }

  /**
   * Reloads a service.
   *
   * @param id Service identifier.
   *
   * @returns Reloaded service.
   */
  public static reload(
    id: string,
  ): ServiceDefinition {
    ServiceLoader.unload(id);

    return ServiceLoader.load(id);
  }

  /**
   * Reloads every registered service.
   *
   * @returns Reloaded services.
   */
  public static reloadAll():
    readonly ServiceDefinition[] {
    ServiceLoader.clear();

    return ServiceLoader.loadAll();
  }

  /**
   * Stops a service.
   *
   * @param id Service identifier.
   *
   * @returns True if stopped.
   */
  public static stop(
    id: string,
  ): boolean {
    return ServiceLoader.unload(id);
  }

  /**
   * Stops every loaded service.
   */
  public static stopAll(): void {
    ServiceLoader.clear();
  }

  /**
   * Returns every active service.
   *
   * @returns Active services.
   */
  public static active():
    readonly ServiceDefinition[] {
    return ServiceLoader.getLoaded();
  }

  /**
   * Returns every registered service.
   *
   * @returns Registered services.
   */
  public static registered():
    readonly ServiceDefinition[] {
    return ServiceRegistry.getAll();
  }
}

export default ServiceManager;