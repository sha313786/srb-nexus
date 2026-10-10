import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

const JOBS = [
  'developed a Discord bot module',
  'moderated a spam attack',
  'fixed a server permissions glitch',
  'designed a custom Canvas welcome banner',
  'configured a PostgreSQL database cluster',
  'helped a new member in general chat',
  'audited server security logs',
];

export const workCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-work')
    .setDescription('Complete a quick job shift to earn money'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    const settingsRes = await db.query(
      `SELECT currency_symbol FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );
    const symbol = settingsRes.rows[0]?.currency_symbol || '🪙';

    const { rows } = await db.query(
      `SELECT last_work FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );

    const now = new Date();
    const lastWork = rows[0]?.last_work ? new Date(rows[0].last_work) : null;
    const cooldownMs = 60 * 60 * 1000; // 1 hour

    if (lastWork && now.getTime() - lastWork.getTime() < cooldownMs) {
      const readyAtTimestamp = Math.floor((lastWork.getTime() + cooldownMs) / 1000);
      await interaction.reply({
        content: `⏳ You are tired from your last shift! Ready to work again <t:${readyAtTimestamp}:R>.`,
        ephemeral: true,
      });
      return;
    }

    // Earn random amount between 30 and 120
    const earned = Math.floor(Math.random() * 90) + 30;
    const randomJob = JOBS[Math.floor(Math.random() * JOBS.length)];

    await db.query(
      `INSERT INTO user_economy (guild_id, user_id, balance, last_work)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         balance = user_economy.balance + $3,
         last_work = NOW()`,
      [guildId, userId, earned]
    );

    const embed = new EmbedBuilder()
      .setTitle('💼 Work Shift Completed!')
      .setDescription(`You **${randomJob}** and earned **${symbol} ${earned.toLocaleString()}**!`)
      .setColor('#3498db')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
