import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../../core/database';

const ICONS = ['🍒', '💎', '7️⃣', '🔔', '🍇', '🪙'];

export const slotsCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-slots')
    .setDescription('High-stakes slot machine mini-game (Win up to 10x your bet!)')
    .addIntegerOption((opt) =>
      opt.setName('bet').setDescription('Amount of coins to bet').setMinValue(10).setMaxValue(50000).setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const bet = interaction.options.getInteger('bet', true);

    const userRes = await db.query(
      `SELECT balance FROM user_economy WHERE guild_id = $1 AND user_id = $2`,
      [interaction.guild.id, interaction.user.id]
    );

    const currentBalance = Number(userRes.rows[0]?.balance || 0);

    if (currentBalance < bet) {
      return interaction.reply({
        content: `❌ Insufficient funds! You only have **${currentBalance.toLocaleString()}** coins, but tried to bet **${bet.toLocaleString()}** coins. Use \`/nexus-daily\` or \`/nexus-work\` to earn more!`,
        ephemeral: true,
      });
    }

    // Spin reels
    const r1 = ICONS[Math.floor(Math.random() * ICONS.length)];
    const r2 = ICONS[Math.floor(Math.random() * ICONS.length)];
    const r3 = ICONS[Math.floor(Math.random() * ICONS.length)];

    let winMultiplier = 0;
    let winMessage = 'Better luck next time!';

    if (r1 === r2 && r2 === r3) {
      if (r1 === '7️⃣') {
        winMultiplier = 10;
        winMessage = '🎉 JACKPOT! TRIPLE SEVENS (10x payout)!';
      } else if (r1 === '💎') {
        winMultiplier = 5;
        winMessage = '💎 DIAMOND DELIGHT (5x payout)!';
      } else {
        winMultiplier = 3;
        winMessage = '🔥 TRIPLE MATCH (3x payout)!';
      }
    } else if (r1 === r2 || r2 === r3 || r1 === r3) {
      winMultiplier = 1.5;
      winMessage = '✨ DOUBLE PAIR (1.5x payout)!';
    }

    const wonAmount = Math.floor(bet * winMultiplier);
    const netProfit = wonAmount - bet;
    const newBalance = currentBalance + netProfit;

    await db.query(
      `INSERT INTO user_economy (guild_id, user_id, balance)
       VALUES ($1, $2, $3)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET balance = $3`,
      [interaction.guild.id, interaction.user.id, newBalance]
    );

    const isWin = winMultiplier > 0;
    const embed = new EmbedBuilder()
      .setColor(isWin ? '#10B981' : '#EF4444')
      .setTitle('🎰 NEXUS CASINO — SLOT MACHINE')
      .setDescription(
        `╔═════════════════╗\n` +
        `║   [ ${r1} | ${r2} | ${r3} ]   ║\n` +
        `╚═════════════════╝\n\n` +
        `**${winMessage}**\n\n` +
        `💰 **Bet:** \`${bet.toLocaleString()}\` coins\n` +
        `💵 **Result:** \`${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()}\` coins\n` +
        `👛 **New Balance:** \`${newBalance.toLocaleString()}\` coins`
      )
      .setFooter({ text: 'SRB NEXUS Virtual Economy' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
