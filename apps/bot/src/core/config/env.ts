/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : env.ts
 * Purpose : Runtime Configuration Manager.
 * =========================================================
 */

import { env } from "../../config/index.js";

/**
 * Runtime configuration for the bot.
 *
 * This module is the single runtime configuration source for
 * the application. It must never read process.env directly.
 *
 * Environment variables are owned by the Environment Manager
 * located in src/config.
 */
export const runtimeConfig = Object.freeze({
  app: Object.freeze({
    name: "SRB NEXUS",
    environment: env.nodeEnv,
    production: env.nodeEnv === "production",
  }),

  bot: Object.freeze({
    startupTimeout: 30_000,
    shutdownTimeout: 15_000,
    heartbeatInterval: 60_000,
  }),

  discord: Object.freeze({
    token: env.discord.token,
  }),

  logging: Object.freeze({
    level: env.nodeEnv === "production" ? "info" : "debug",
    colors: true,
    timestamps: true,
  }),

  dashboard: Object.freeze({
    enabled: true,
    refreshInterval: 5_000,
  }),

  api: Object.freeze({
    enabled: true,
    port: 3000,
  }),

  features: Object.freeze({
    dashboard: true,
    api: true,
    commands: true,
    metrics: false,
  }),
});

export type RuntimeConfig = typeof runtimeConfig;