/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : index.ts
 * Purpose : Application entry point
 * =========================================================
 */

import "dotenv/config";

import { Client, GatewayIntentBits } from "discord.js";

import { env } from "./config/index.js";
import { Logger } from "./core/logger/logger.js";

Logger.info("Starting SRB NEXUS...");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

client.once("clientReady", (readyClient) => {
  Logger.success(`Logged in as ${readyClient.user.tag}`);
});

client
  .login(env.discord.token)
  .catch((error: unknown) => {
    Logger.error(`Failed to login: ${String(error)}`);
    process.exit(1);
  });

process.on("SIGINT", () => {
  Logger.warn("Shutting down...");
  client.destroy();
  process.exit(0);
});

process.on("SIGTERM", () => {
  Logger.warn("Shutting down...");
  client.destroy();
  process.exit(0);
});