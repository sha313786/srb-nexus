import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { logModAction } from '../../moderation/logger';

export const kickCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-kick')
    .setDescription('Kicks a user from the server')
    .addUserOption((opt) => opt.setName('target').setDescription('Member to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({ content: 'Cannot kick this user (insufficient permissions or higher role).', ephemeral: true });
      return;
    }

    await member.kick(`[NEXUS MOD] ${reason}`);

    await logModAction({
      guild: interaction.guild,
      targetId: targetUser.id,
      targetTag: targetUser.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      action: 'KICK',
      reason,
    });

    await interaction.reply({ content: `✅ Successfully kicked **${targetUser.tag}**. Reason: \`${reason}\`` });
  },
};