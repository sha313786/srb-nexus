import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const warningsCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-warnings')
    .setDescription('Displays warning history for a user')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);

    const { rows } = await db.query(
      `SELECT id, moderator_id, reason, created_at 
       FROM user_warnings 
       WHERE guild_id = $1 AND user_id = $2 
       ORDER BY created_at DESC LIMIT 10`,
      [interaction.guild.id, targetUser.id]
    );

    if (!rows || rows.length === 0) {
      await interaction.reply({
        content: `✅ **${targetUser.tag}** has a clean record with 0 warnings.`,
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`⚠️ Warning Records: ${targetUser.tag} (${rows.length})`)
      .setColor('#f39c12')
      .setThumbnail(targetUser.displayAvatarURL());

    rows.forEach((w: any, index: number) => {
      const date = new Date(w.created_at).toLocaleDateString();
      embed.addFields({
        name: `#${w.id} • ${date}`,
        value: `**Moderator:** <@${w.moderator_id}>\n**Reason:** ${w.reason}`,
      });
    });

    await interaction.reply({ embeds: [embed] });
  },
};
