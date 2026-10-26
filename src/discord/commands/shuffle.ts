import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { shuffleQueue } from '../../services/musicService';

function createShuffleBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Shuffle all tracks currently waiting in the queue');
}

export async function executeShuffle(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to shuffle the queue.',
      ephemeral: true,
    });
    return;
  }

  const result = await shuffleQueue(member);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔀 Queue Shuffled')
    .setDescription(result.message)
    .setFooter({
      text: `Shuffled by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const shuffleCommand = {
  data: createShuffleBuilder('shuffle'),
  execute: executeShuffle,
};

export const nexusShuffleCommand = {
  data: createShuffleBuilder('nexus-shuffle'),
  execute: executeShuffle,
};
