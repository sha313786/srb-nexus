/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : types.ts
 * Purpose : Environment Manager type definitions.
 * =========================================================
 */

/**
 * Supported Node.js environments.
 */
export type NodeEnvironment =
  | "development"
  | "production"
  | "test";

/**
 * Discord environment configuration.
 */
export interface DiscordEnvironment {
  /**
   * Discord Bot Token.
   */
  token: string;
}

/**
 * Root environment configuration.
 */
export interface EnvironmentConfig {
  /**
   * Current Node.js environment.
   */
  nodeEnv: NodeEnvironment;

  /**
   * Discord configuration.
   */
  discord: DiscordEnvironment;
}