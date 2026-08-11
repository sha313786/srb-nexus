import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const modlogsCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-modlogs')
    .setDescription('Fetches moderation history for a user')
    .addUserOption((opt) => opt.setName('target').setDescription('User to look up').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);

    const { rows } = await db.query(
      `SELECT action, moderator_user_id, reason, created_at 
       FROM moderation_logs 
       WHERE guild_id = $1 AND target_user_id = $2 
       ORDER BY created_at DESC LIMIT 10`,
      [interaction.guild.id, targetUser.id]
    );

    if (rows.length === 0) {
      await interaction.reply({ content: `No moderation records found for **${targetUser.tag}**.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Moderation History: ${targetUser.tag}`)
      .setColor(0x2b2d31)
      .setThumbnail(targetUser.displayAvatarURL());

    rows.forEach((log, index) => {
      const date = new Date(log.created_at).toLocaleDateString();
      embed.addFields({
        name: `#${index + 1} | ${log.action} (${date})`,
        value: `**Moderator:** <@${log.moderator_user_id}>\n**Reason:** ${log.reason}`,
      });
    });

    await interaction.reply({ embeds: [embed] });
  },
};