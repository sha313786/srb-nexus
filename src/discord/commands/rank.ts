import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const rankCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-rank')
    .setDescription('Displays your current rank, level, and XP progression')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target') || interaction.user;

    // Fetch user economy record
    const { rows } = await db.query(
      `SELECT xp, level, 
              (SELECT COUNT(*) + 1 FROM user_economy WHERE guild_id = $1 AND xp > u.xp) as rank
       FROM user_economy u
       WHERE guild_id = $1 AND user_id = $2`,
      [interaction.guild.id, targetUser.id]
    );

    const userStats = rows[0] || { xp: 0, level: 1, rank: 1 };
    const level = Number(userStats.level) || 1;
    const xp = Number(userStats.xp) || 0;
    const rank = Number(userStats.rank) || 1;

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
  },
};
