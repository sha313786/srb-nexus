import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from 'discord.js';
import { muteAllVoice } from '../../services/voiceManagement';

function createMuteallBuilder(name: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription('Server-mute all connected members in a voice channel')
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
        .setDescription('Reason for the mass mute action')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('exclude_bots')
        .setDescription('Skip bots from being server-muted (default: true)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('exclude_self')
        .setDescription('Skip yourself from being server-muted (default: true)')
        .setRequired(false)
    );
}

async function executeMuteall(interaction: ChatInputCommandInteraction) {
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
  const reason = interaction.options.getString('reason') || `Mass mute requested by ${interaction.user.tag}`;
  const excludeBots = interaction.options.getBoolean('exclude_bots') ?? true;
  const excludeSelf = interaction.options.getBoolean('exclude_self') ?? true;

  const result = await muteAllVoice(interaction.guild, {
    channelId: targetChannel ? targetChannel.id : undefined,
    moderator: {
      id: interaction.user.id,
      tag: interaction.user.tag,
    },
    reason,
    excludeBots,
    excludeSelf,
  });

  const embed = new EmbedBuilder()
    .setTitle(result.success ? '🔇 Voice Mass Mute' : '⚠️ Mass Mute Notice')
    .setColor(result.success ? (result.affected > 0 ? 0xef4444 : 0xf59e0b) : 0xef4444)
    .setDescription(result.message)
    .addFields(
      { name: 'Channel', value: `\`${result.channelName || 'N/A'}\``, inline: true },
      { name: 'Muted', value: `**${result.affected}**`, inline: true },
      { name: 'Skipped', value: `**${result.skipped}**`, inline: true }
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

export const muteallCommand = {
  data: createMuteallBuilder('muteall'),
  execute: executeMuteall,
};

export const nexusMuteallCommand = {
  data: createMuteallBuilder('nexus-muteall'),
  execute: executeMuteall,
};
