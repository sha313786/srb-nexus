import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { db } from '../../core/database';

export const clearwarnCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-clearwarn')
    .setDescription('Clears warnings for a user')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(true))
    .addIntegerOption((opt) => opt.setName('warning_id').setDescription('Specific warning ID to remove (optional)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);
    const warningId = interaction.options.getInteger('warning_id');

    if (warningId) {
      const res = await db.query(
        `DELETE FROM user_warnings WHERE guild_id = $1 AND user_id = $2 AND id = $3`,
        [interaction.guild.id, targetUser.id, warningId]
      );
      if (res.rowCount === 0) {
        await interaction.reply({ content: `❌ Warning #${warningId} not found for this user.`, ephemeral: true });
        return;
      }
      await interaction.reply({ content: `✅ Cleared warning #${warningId} for **${targetUser.tag}**.` });
    } else {
      const res = await db.query(
        `DELETE FROM user_warnings WHERE guild_id = $1 AND user_id = $2`,
        [interaction.guild.id, targetUser.id]
      );
      await interaction.reply({ content: `✅ Cleared all (${res.rowCount}) warnings for **${targetUser.tag}**.` });
    }
  },
};
