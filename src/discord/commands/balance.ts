import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { db } from '../../core/database';

export const balanceCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-balance')
    .setDescription('Checks your wallet and bank balance')
    .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const targetUser = interaction.options.getUser('target') || interaction.user;

    const settingsRes = await db.query(
      `SELECT currency_symbol FROM guild_settings WHERE guild_id = $1`,
      [interaction.guild.id]
    );
    const symbol = settingsRes.rows[0]?.currency_symbol || '🪙';

    const { rows } = await db.query(
      `SELECT balance, bank FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [interaction.guild.id, targetUser.id]
    );

    const userEco = rows[0] || { balance: 0, bank: 0 };
    const wallet = Number(userEco.balance) || 0;
    const bank = Number(userEco.bank) || 0;
    const total = wallet + bank;

    const embed = new EmbedBuilder()
      .setTitle(`💰 ${targetUser.username}'s Vault`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setColor('#2ecc71')
      .addFields(
        { name: 'Wallet', value: `${symbol} ${wallet.toLocaleString()}`, inline: true },
        { name: 'Bank', value: `${symbol} ${bank.toLocaleString()}`, inline: true },
        { name: 'Net Worth', value: `${symbol} ${total.toLocaleString()}`, inline: true }
      )
      .setFooter({ text: 'SRB NEXUS Economy' });

    await interaction.reply({ embeds: [embed] });
  },
};
