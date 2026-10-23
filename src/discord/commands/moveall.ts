import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { moveAllVoice } from '../../services/voiceManagement';

function createMoveallBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Mass-move connected voice members from one room to another')
    .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
    .addChannelOption((opt) =>
      opt
        .setName('target')
        .setDescription('Target destination voice channel')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('source')
        .setDescription('Source voice channel (defaults to your current voice channel or all connected rooms)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('reason')
        .setDescription('Reason for the mass move action')
        .setRequired(false)
    );
}

async function executeMoveall(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    return;
  }

  // Double-check caller permissions
  const permissions = interaction.memberPermissions;
  if (!permissions?.has(PermissionFlagsBits.MoveMembers) && !permissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You require the **Move Members** or **Administrator** permission to use this command.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targetChannel = interaction.options.getChannel('target', true);
  const sourceChannel = interaction.options.getChannel('source');
  const reason = interaction.options.getString('reason') || `Mass move requested by ${interaction.user.tag}`;

  const result = await moveAllVoice(interaction.guild, {
    targetChannelId: targetChannel.id,
    sourceChannelId: sourceChannel ? sourceChannel.id : undefined,
    moderator: {
      id: interaction.user.id,
      tag: interaction.user.tag,
    },
    reason,
  });

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '🔀 Voice Mass Move' : '⚠️ Mass Move Notice')
    .setColor(result.success ? 0x6366f1 : 0xef4444)
    .setDescription(result.message)
    .addFields(
      { name: 'Source', value: `\`${result.channelName || 'N/A'}\``, inline: true },
      { name: 'Destination', value: `\`${result.targetChannelName || targetChannel.name}\``, inline: true },
      { name: 'Moved', value: `**${result.affected}**`, inline: true }
    )
    .setFooter({
      text: `Action executed by ${interaction.user.tag}`,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setTimestamp();

  if (result.failed > 0) {
    embed.addFields({
      name: 'Failed',
      value: `**${result.failed}** (could not move member)`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

export const moveallCommand = {
  data: createMoveallBuilder('moveall'),
  execute: executeMoveall,
};

export const nexusMoveallCommand = {
  data: createMoveallBuilder('nexus-moveall'),
  execute: executeMoveall,
};
