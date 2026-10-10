import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const dailyCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-daily')
    .setDescription('Claims your daily economic grant'),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // Fetch guild economy settings
    const settingsRes = await db.query(
      `SELECT currency_symbol, daily_reward FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );
    const symbol = settingsRes.rows[0]?.currency_symbol || '🪙';
    const reward = Number(settingsRes.rows[0]?.daily_reward) || 100;

    // Fetch user economy record
    const { rows } = await db.query(
      `SELECT balance, last_daily FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );

    const now = new Date();
    const lastDaily = rows[0]?.last_daily ? new Date(rows[0].last_daily) : null;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

    if (lastDaily && now.getTime() - lastDaily.getTime() < cooldownMs) {
      const remainingSeconds = Math.ceil((cooldownMs - (now.getTime() - lastDaily.getTime())) / 1000);
      const readyAtTimestamp = Math.floor((lastDaily.getTime() + cooldownMs) / 1000);
      await interaction.reply({
        content: `⏳ You have already claimed your daily reward. Ready again <t:${readyAtTimestamp}:R>.`,
        ephemeral: true,
      });
      return;
    }

    // Upsert user economy
    await db.query(
      `INSERT INTO user_economy (guild_id, user_id, balance, last_daily)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         balance = user_economy.balance + $3,
         last_daily = NOW()`,
      [guildId, userId, reward]
    );

    const embed = new EmbedBuilder()
      .setTitle('🎁 Daily Reward Claimed!')
      .setDescription(`You received **${symbol} ${reward.toLocaleString()}** into your wallet!`)
      .setColor('#2ecc71')
      .setFooter({ text: 'Come back in 24 hours for your next grant' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
