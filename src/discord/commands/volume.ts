import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  EmbedBuilder,
} from 'discord.js';
import { setVolume } from '../../services/musicService';

function createVolumeBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Set the music playback volume (1% - 100%)')
    .addIntegerOption((opt) =>
      opt
        .setName('level')
        .setDescription('Volume percentage (1 to 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    );
}

export async function executeVolume(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!member.voice.channel) {
    await interaction.reply({
      content: '❌ You must be connected to a voice channel to adjust music volume.',
      ephemeral: true,
    });
    return;
  }

  const level = interaction.options.getInteger('level', true);
  const result = await setVolume(member, level);

  if (!result.success) {
    await interaction.reply({ content: result.message, ephemeral: true });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔊 Volume Adjusted')
    .setDescription(result.message)
    .setFooter({
      text: `Adjusted by ${member.user.tag}`,
      iconURL: member.user.displayAvatarURL(),
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

export const volumeCommand = {
  data: createVolumeBuilder('volume'),
  execute: executeVolume,
};

export const nexusVolumeCommand = {
  data: createVolumeBuilder('nexus-volume'),
  execute: executeVolume,
};
