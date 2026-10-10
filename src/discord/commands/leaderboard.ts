import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-leaderboard')
    .setDescription('Displays the top 10 ranked members on the server'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const { rows } = await db.query(
      `SELECT user_id, xp, level 
       FROM user_economy 
       WHERE guild_id = $1 
       ORDER BY xp DESC LIMIT 10`,
      [interaction.guild.id]
    );

    if (!rows || rows.length === 0) {
      await interaction.reply({ content: '📊 No members have gained XP in this server yet.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${interaction.guild.name} — Top 10 Leaderboard`)
      .setColor('#f1c40f')
      .setThumbnail(interaction.guild.iconURL({ size: 256 }));

    const medals = ['🥇', '🥈', '🥉'];

    const lines = rows.map((u: any, index: number) => {
      const medal = medals[index] || `\`#${index + 1}\``;
      return `${medal} **<@${u.user_id}>** — Level **${u.level}** • **${Number(u.xp).toLocaleString()}** XP`;
    });

    embed.setDescription(lines.join('\n\n'));
    embed.setFooter({ text: 'SRB NEXUS Leaderboards' }).setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
