import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { stopPlayback } from '../../services/musicService';

function createStopBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Stop playback, clear the entire music queue, and disconnect the bot');
}

export async function executeStop(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to stop music.',
      ephemeral: true,
    });
    return;
  }

  const result = await stopPlayback(member);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle('⏹️ Playback Terminated')
    .setDescription(result.message)
    .setFooter({
      text: `Stopped by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const stopCommand = {
  data: createStopBuilder('stop'),
  execute: executeStop,
};

export const nexusStopCommand = {
  data: createStopBuilder('nexus-stop'),
  execute: executeStop,
};
