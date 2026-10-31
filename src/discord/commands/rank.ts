import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserRank } from '../../services/levelingService';

export const rankCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-rank')
    .setDescription('Displays your current rank, level, and XP progression')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    try {
      const targetUser = interaction.options.getUser('target') || interaction.user;
      const userStats = await getUserRank(interaction.guild, targetUser.id);

      const level = userStats.level;
      const xp = userStats.xp;
      const rank = userStats.rank;

      // XP calculation: each level requires (level * 150) XP
      const currentLevelBaseXp = ((level - 1) * 150);
      const nextLevelTargetXp = (level * 150);
      const progressXp = Math.max(0, xp - currentLevelBaseXp);
      const requiredLevelXp = Math.max(1, nextLevelTargetXp - currentLevelBaseXp);
      const progressPercent = Math.min(100, Math.floor((progressXp / requiredLevelXp) * 100));

      // Render Progress Bar
      const totalBars = 12;
      const filledBars = Math.floor((progressPercent / 100) * totalBars);
      const bar = '▰'.repeat(filledBars) + '▱'.repeat(totalBars - filledBars);

      const embed = new EmbedBuilder()
        .setTitle(`⭐ ${targetUser.username}'s Rank Card`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .setColor('#9b59b6')
        .addFields(
          { name: 'Rank', value: `#${rank}`, inline: true },
          { name: 'Level', value: `${level}`, inline: true },
          { name: 'Total XP', value: `${xp.toLocaleString()}`, inline: true },
          {
            name: `Progress to Level ${level + 1} (${progressPercent}%)`,
            value: `\`${bar}\`\n${progressXp} / ${requiredLevelXp} XP`,
            inline: false,
          }
        )
        .setFooter({ text: 'SRB NEXUS Leveling Engine' });

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({ content: '⚠️ Failed to fetch rank card. Please try again shortly.', ephemeral: true });
    }
  },
};
