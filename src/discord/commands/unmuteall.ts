import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { unmuteAllVoice } from '../../services/voiceManagement';

function createUnmuteallBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Server-unmute all members in a voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target voice channel (defaults to your current voice channel)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the mass unmute action')
        .setRequired(false)
    );
}

async function executeUnmuteall(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  // Double-check caller permissions
  const permissions = interaction.memberPermissions;
  if (!permissions?.has(PermissionFlagsBits.MuteMembers) && !permissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You require the **Mute Members** or **Administrator** permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetChannel = interaction.options.getChannel('channel');
  const reason = interaction.options.getString('reason') || `Mass unmute requested by ${interaction.user.tag}`;

  const result = await unmuteAllVoice(interaction.guild, {
    channelId: targetChannel ? targetChannel.id : undefined,
    moderator: {
      id: interaction.user.id,
      tag: interaction.user.tag,
    },
    reason,
  });

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '🔊 Voice Mass Unmute' : '⚠️ Mass Unmute Notice')
    .setColor(result.success ? 0x10b981 : 0xef4444)
    .setDescription(result.message)
    .addFields(
      { name: 'Channel', value: `\`${result.channelName || 'N/A'}\``, inline: true },
      { name: 'Unmuted', value: `**${result.affected}**`, inline: true }
    )
    .setFooter({
      text: `Action executed by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  if (result.failed > 0) {
    embed.addFields({
      name: 'Failed (Hierarchy)',
      value: `**${result.failed}** (members have higher or equal role to bot)`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

export const unmuteallCommand = {
  data: createUnmuteallBuilder('unmuteall'),
  execute: executeUnmuteall,
};

export const nexusUnmuteallCommand = {
  data: createUnmuteallBuilder('nexus-unmuteall'),
  execute: executeUnmuteall,
};
