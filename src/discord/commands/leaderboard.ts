import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getTopXpForGuild } from '../../services/levelingService';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-leaderboard')
    .setDescription('Displays the top 10 ranked members on the server'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    try {
      const topXp = await getTopXpForGuild(interaction.guild, 10);

      if (!topXp || topXp.length === 0) {
        await interaction.reply({ content: '📜 No members have gained XP in this server yet.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏆 ${interaction.guild.name} — Top 10 Leaderboard`)
        .setColor('#f1c40f')
        .setThumbnail(interaction.guild.iconURL({ size: 256 }));

      const medals = ['🥇', '🥈', '🥉'];

      const lines = topXp.map((u, index) => {
        const medal = medals[index] || `\`#${index + 1}\``;
        return `${medal} **${u.username}** — Level **${u.level}** • **${Number(u.xp).toLocaleString()}** XP`;
      });

      embed.setDescription(lines.join('\n\n'));
      embed.setFooter({ text: 'SRB NEXUS Leaderboards' }).setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({ content: '⚠️ Failed to fetch leaderboard rankings. Please try again shortly.', ephemeral: true });
    }
  },
};
