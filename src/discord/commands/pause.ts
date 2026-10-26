import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { pauseResumeTrack } from '../../services/musicService';

function createPauseBuilder(name: string, desc: string) {
  return new SlashCommandBuilder().setName(name).setDescription(desc);
}

export async function executePauseResume(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to pause/resume playback.',
      ephemeral: true,
    });
    return;
  }

  const result = await pauseResumeTrack(member);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(result.isPaused ? 0xf59e0b : 0x10b981)
    .setTitle(result.isPaused ? '⏸️ Music Paused' : '▶️ Music Resumed')
    .setDescription(result.message)
    .setFooter({
      text: `Actioned by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const pauseCommand = {
  data: createPauseBuilder('pause', 'Pause current music playback'),
  execute: executePauseResume,
};

export const resumeCommand = {
  data: createPauseBuilder('resume', 'Resume paused music playback'),
  execute: executePauseResume,
};

export const nexusPauseCommand = {
  data: createPauseBuilder('nexus-pause', 'Pause current music playback'),
  execute: executePauseResume,
};

export const nexusResumeCommand = {
  data: createPauseBuilder('nexus-resume', 'Resume paused music playback'),
  execute: executePauseResume,
};
