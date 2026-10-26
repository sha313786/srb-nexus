import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { getQueueEmbed } from '../../services/musicService';

function createQueueBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('View the current music queue and upcoming tracks')
    .addIntegerOption((opt) =>
      opt
        .setName('page')
        .setDescription('Queue page number to view (default: 1)')
        .setMinValue(1)
        .setRequired(false)
    );
}

export async function executeQueue(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const page = interaction.options.getInteger('page') || 1;
  const embed = getQueueEmbed(interaction.guild.id, page);

  if (!embed) {
    await interaction.reply({
      content: '❌ No songs are currently queued or playing. Use `/play` to add music!',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({ embeds: [embed] });
}

export const queueCommand = {
  data: createQueueBuilder('queue'),
  execute: executeQueue,
};

export const nexusQueueCommand = {
  data: createQueueBuilder('nexus-queue'),
  execute: executeQueue,
};
