import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';
import { logModAction } from '../../moderation/logger';

export const warnCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-warn')
    .setDescription('Issues a formal warning to a server member')
    .addUserOption((opt) => opt.setName('target').setDescription('User to warn').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target', true);
    const reason = interaction.options.getString('reason', true);

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: '❌ You cannot warn yourself.', ephemeral: true });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({ content: '❌ You cannot warn bot accounts.', ephemeral: true });
      return;
    }

    // 1. Persist to database
    await db.query(
      `INSERT INTO user_warnings (guild_id, user_id, moderator_id, reason)
       VALUES ($1, $2, $3, $4)`,
      [interaction.guild.id, targetUser.id, interaction.user.id, reason]
    );

    // 2. Log Moderation Action
    await logModAction({
      guild: interaction.guild,
      targetId: targetUser.id,
      targetTag: targetUser.tag,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      action: 'TIMEOUT', // Logged under moderation trail
      reason: `[WARN] ${reason}`,
    });

    // 3. Try to DM the user
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle(`⚠️ Warning in ${interaction.guild.name}`)
        .setColor('#f39c12')
        .setDescription(`You have received a formal warning from **<@${interaction.user.id}>**.\n\n**Reason:** ${reason}`)
        .setTimestamp();
      await targetUser.send({ embeds: [dmEmbed] });
    } catch {
      // DMs closed, ignore
    }

    await interaction.reply({
      content: `⚠️ Successfully warned **${targetUser.tag}**. Reason: \`${reason}\``,
    });
  },
};
