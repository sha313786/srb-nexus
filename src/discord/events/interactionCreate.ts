import { Interaction, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { commandRegistry } from '../commands';
import { logger } from '../../core/logger';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // 1. HANDLE SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    const command = commandRegistry.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, commandName: interaction.commandName }, 'Error executing slash command');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred while executing this command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
      }
    }
    return;
  }

  // 2. HANDLE TICKET BUTTON CLICK
  if (interaction.isButton() && interaction.customId === 'nexus_create_ticket') {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      // Create private text channel for the user
      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.id, // Hide from @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id, // Grant access to the ticket creator
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      // Send initial welcome embed inside the ticket channel
      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`Ticket: ${interaction.user.username}`)
        .setDescription('Thank you for reaching out! Please state your issue below, and a staff member will assist you shortly.')
        .setColor('#9333ea');

      await ticketChannel.send({
        content: `<@${interaction.user.id}>`,
        embeds: [welcomeEmbed],
      });

      // Confirm creation privately to the user
      await interaction.reply({
        content: `Your ticket channel has been created: ${ticketChannel}`,
        ephemeral: true,
      });
    } catch (err) {
      logger.error({ err }, 'Failed to create ticket channel');
      await interaction.reply({
        content: 'Failed to create ticket channel. Please check bot permissions.',
        ephemeral: true,
      });
    }
  }
}