// Path: src/discord/events/interactionCreate.ts
import { Interaction, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { commandRegistry } from '../commands';
import { logger } from '../../core/logger';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // 1. HANDLE SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    const command = commandRegistry.get(interaction.commandName);

    // If the command is registered in Discord but missing in commandRegistry
    if (!command) {
      logger.warn(`[BOT] Command implementation missing for /${interaction.commandName}`);
      await interaction.reply({
        content: `Command \`/${interaction.commandName}\` is registered but not implemented in code.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, commandName: interaction.commandName }, 'Error executing slash command');
      
      const errorMessage = 'An error occurred while executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
    return;
  }

  // 2. HANDLE TICKET BUTTON CLICK
  if (interaction.isButton() && interaction.customId === 'nexus_create_ticket') {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      // Defer reply immediately so Discord knows the button was acknowledged
      await interaction.deferReply({ ephemeral: true });

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket: ${interaction.user.username}`)
        .setDescription('Thank you for reaching out! Please state your issue below, and a staff member will assist you shortly.')
        .setColor('#9333ea');

      await ticketChannel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [welcomeEmbed],
      });

      await interaction.editReply({
        content: `Your ticket channel has been created: ${ticketChannel}`,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to create ticket channel');
      
      if (interaction.deferred) {
        await interaction.editReply({
          content: 'Failed to create ticket channel. Please check bot permissions.',
        });
      } else {
        await interaction.reply({
          content: 'Failed to create ticket channel. Please check bot permissions.',
          ephemeral: true,
        });
      }
    }
  }
}