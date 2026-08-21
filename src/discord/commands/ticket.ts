// Path: src/discord/commands/ticket.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket')
    .setDescription('Manage or close a support ticket')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({ content: 'Ticket command executed.', ephemeral: true });
  },
};