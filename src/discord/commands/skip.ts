import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { skipTrack } from '../../services/musicService';

function createSkipBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Skip the currently playing track to the next song in queue');
}

export async function executeSkip(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to skip music.',
      ephemeral: true,
    });
    return;
  }

  const result = await skipTrack(member);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('⏭️ Track Skipped')
    .setDescription(result.message)
    .setFooter({
      text: `Skipped by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const skipCommand = {
  data: createSkipBuilder('skip'),
  execute: executeSkip,
};

export const nexusSkipCommand = {
  data: createSkipBuilder('nexus-skip'),
  execute: executeSkip,
};
