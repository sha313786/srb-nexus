/**
 * =========================================================
 * SRB NEXUS
 * Your Server. Your Rules. Your Nexus.
 *
 * Copyright (c) 2026 SRB Studios
 *
 * File    : interaction-create.ts
 * Purpose : Discord interaction event.
 * =========================================================
 */

import { Client, Events } from "discord.js";

import { Logger } from "../core/logger/logger.js";

export function registerInteractionCreateEvent(
  client: Client,
): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    Logger.info(
      `Interaction received from ${interaction.user.tag}`,
    );

    if (!interaction.isChatInputCommand()) {
      return;
    }

    Logger.info(
      `Slash command: /${interaction.commandName}`,
    );
  });
}