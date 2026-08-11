import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { logModAction } from '../../moderation/logger';

export const timeoutCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-timeout')
    .setDescription('Applies a timed mute to a member')
    .addUserOption((opt) => opt.setName('target').setDescription('Member to timeout').setRequired(true))
    .addIntegerOption((opt) => opt.setName('duration_minutes').setDescription('Duration in minutes').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);
    const minutes = interaction.options.getInteger('duration_minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!member) {
      await interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
      return;
    }

    const durationMs = minutes * 60 * 1000;
    await member.timeout(durationMs, `[NEXUS MOD] ${reason}`);

    await logModAction({
      guild: interaction.guild,
      targetId: targetUser.id,
      targetTag: targetUser.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      action: 'TIMEOUT',
      reason,
      durationSec: minutes * 60,
    });

    await interaction.reply({ content: `⏳ Timed out **${targetUser.tag}** for **${minutes} minutes**. Reason: \`${reason}\`` });
  },
};