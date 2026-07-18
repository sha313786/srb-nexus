/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : client-ready.ts
 * Purpose : Discord Client Ready Event
 * =========================================================
 */

import { Client, Events } from "discord.js";

import { Logger } from "../core/logger/logger.js";

/**
 * Register the Discord Client Ready event.
 */
export function registerClientReadyEvent(
  client: Client,
): void {
  client.once(
    Events.ClientReady,
    (readyClient) => {
      Logger.success(
        `Logged in as ${readyClient.user.tag}`,
      );
    },
  );
}

export default registerClientReadyEvent;