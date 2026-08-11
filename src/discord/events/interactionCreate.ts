import { Interaction } from 'discord.js';
import { commandRegistry } from '../commands';
import { logger } from '../../core/logger';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

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
}