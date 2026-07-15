/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : env.ts
 * Purpose : Centralized application environment configuration.
 * =========================================================
 */

import type { EnvironmentConfig } from "./types.js";

import {
  getNodeEnvironment,
  requireEnv,
} from "./validate.js";

/**
 * Immutable application environment.
 *
 * Every module within SRB NEXUS must import this object
 * instead of reading process.env directly.
 */
export const env: Readonly<EnvironmentConfig> = Object.freeze({
  nodeEnv: getNodeEnvironment(),

  discord: {
    token: requireEnv("DISCORD_TOKEN"),
  },
});