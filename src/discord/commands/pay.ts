import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const payCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-pay')
    .setDescription('Transfer money from your wallet to another member')
    .addUserOption((opt) => opt.setName('target').setDescription('Recipient user').setRequired(true))
    .addIntegerOption((opt) => opt.setName('amount').setDescription('Amount to transfer').setRequired(true).setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const guildId = interaction.guild.id;
    const senderId = interaction.user.id;
    const targetUser = interaction.options.getUser('target', true);
    const amount = interaction.options.getInteger('amount', true);

    if (targetUser.id === senderId) {
      await interaction.reply({ content: '❌ You cannot transfer money to yourself.', ephemeral: true });
      return;
    }

    if (targetUser.bot) {
      await interaction.reply({ content: '❌ You cannot transfer money to bot accounts.', ephemeral: true });
      return;
    }

    const settingsRes = await db.query(
      `SELECT currency_symbol FROM guild_settings WHERE guild_id = $1`,
      [guildId]
    );
    const symbol = settingsRes.rows[0]?.currency_symbol || '🪙';

    // Verify sender balance
    const senderRes = await db.query(
      `SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [guildId, senderId]
    );

    const senderBalance = Number(senderRes.rows[0]?.balance) || 0;
    if (senderBalance < amount) {
      await interaction.reply({
        content: `❌ Insufficient funds! You only have **${symbol} ${senderBalance.toLocaleString()}** in your wallet.`,
        ephemeral: true,
      });
      return;
    }

    // Deduct from sender
    await db.query(
      `UPDATE user_economy SET balance = balance - $1 WHERE guild_id = $2 AND user_id = $3`,
      [amount, guildId, senderId]
    );

    // Credit to receiver
    await db.query(
      `INSERT INTO user_economy (guild_id, user_id, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id) DO UPDATE SET
         balance = user_economy.balance + $3`,
      [guildId, targetUser.id, amount]
    );

    const embed = new EmbedBuilder()
      .setTitle('💸 Transfer Successful!')
      .setColor('#2ecc71')
      .setDescription(`Successfully sent **${symbol} ${amount.toLocaleString()}** to **<@${targetUser.id}>**!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
