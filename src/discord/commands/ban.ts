import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { logModAction } from '../../moderation/logger';

export const banCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ban')
    .setDescription('Bans a user from the server')
    .addUserOption((opt) => opt.setName('target').setDescription('User to ban').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('delete_days').setDescription('Days of message history to clear (0-7)').setRequired(false)
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const reason = interaction.options.getString('reason') || 'No reason provided';

    await interaction.guild.members.ban(targetUser.id, {
      deleteMessageSeconds: deleteDays * 86400,
      reason: `[NEXUS MOD] ${reason}`,
    });

    await logModAction({
      guild: interaction.guild,
      targetId: targetUser.id,
      targetTag: targetUser.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      action: 'BAN',
      reason,
    });

    await interaction.reply({ content: `🔨 Successfully banned **${targetUser.tag}**. Reason: \`${reason}\`` });
  },
};