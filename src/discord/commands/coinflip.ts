import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const coinflipCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-coinflip')
    .setDescription('Bet your coins on a coinflip game')
    .addIntegerOption((opt) => opt.setName('amount').setDescription('Amount to bet').setRequired(true).setMinValue(1))
    .addStringOption((opt) =>
      opt.setName('side')
        .setDescription('Heads or Tails')
        .setRequired(true)
        .addChoices({ name: 'Heads', value: 'heads' }, { name: 'Tails', value: 'tails' })
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const userId = interaction.user.id;
    const bet = interaction.options.getInteger('amount', true);
    const chosenSide = interaction.options.getString('side', true);

    const settingsRes = await db.query(
      `SELECT currency_symbol FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );
    const symbol = settingsRes.rows[0]?.currency_symbol || '🪙';

    const { rows } = await db.query(
      `SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, userId]
    );

    const currentBalance = Number(rows[0]?.balance) || 0;
    if (currentBalance < bet) {
      await interaction.reply({
        content: `❌ Insufficient balance! You only have **${symbol} ${currentBalance.toLocaleString()}** in your wallet.`,
        ephemeral: true,
      });
      return;
    }

    const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = outcome === chosenSide;

    if (won) {
      await db.query(
        `UPDATE user_economy SET balance = balance + $1 WHERE guild_id = $2 AND user_id = $3`,
        [bet, guildId, userId]
      );
    } else {
      await db.query(
        `UPDATE user_economy SET balance = balance - $1 WHERE guild_id = $2 AND user_id = $3`,
        [bet, guildId, userId]
      );
    }

    const embed = new EmbedBuilder()
      .setTitle(`🪙 Coinflip: Result is ${outcome.toUpperCase()}!`)
      .setColor(won ? '#2ecc71' : '#e74c3c')
      .setDescription(
        won
          ? `🎉 **You won!** The coin landed on **${outcome}**. You earned **+${symbol} ${bet.toLocaleString()}**!`
          : `💀 **You lost!** The coin landed on **${outcome}**. You lost **-${symbol} ${bet.toLocaleString()}**.`
      )
      .setFooter({ text: `New Balance: ${symbol} ${(won ? currentBalance + bet : currentBalance - bet).toLocaleString()}` });

    await interaction.reply({ embeds: [embed] });
  },
};
