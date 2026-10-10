import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { db } from '../../core/database';

export const giveawayRerollCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-giveaway-reroll')
    .setDescription('Re-roll winner(s) for a concluded giveaway')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName('message_id').setDescription('Message ID of the concluded giveaway').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const messageId = interaction.options.getString('message_id', true).trim();

    await interaction.deferReply({ ephemeral: true });

    const res = await db.query(
      `SELECT * FROM giveaways WHERE guild_id = $1 AND message_id = $2`,
      [interaction.guild.id, messageId]
    );

    if (res.rows.length === 0) {
      return interaction.editReply({
        content: `❌ No giveaway found with message ID \`${messageId}\` in this server.`,
      });
    }

    const giveaway = res.rows[0];
    const entries: string[] = giveaway.entries || [];

    if (entries.length === 0) {
      return interaction.editReply({
        content: `❌ Cannot re-roll: No eligible entries were recorded for this giveaway.`,
      });
    }

    // Pick new winner(s)
    const winnerCount = Math.min(giveaway.winner_count || 1, entries.length);
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    const newWinners = shuffled.slice(0, winnerCount);

    await db.query(
      `UPDATE giveaways SET winners = $1 WHERE id = $2`,
      [newWinners, giveaway.id]
    );

    // Announce in channel
    try {
      const channel = (await interaction.guild.channels.fetch(giveaway.channel_id)) as TextChannel;
      if (channel && channel.isTextBased()) {
        const winnerMentions = newWinners.map((w) => `<@${w}>`).join(', ');
        await channel.send({
          content: `🔄 **GIVEAWAY RE-ROLL!**\nCongratulations ${winnerMentions}! You won **${giveaway.prize}**! 🎉`,
        });
      }
    } catch {
      // Channel fetch error
    }

    return interaction.editReply({
      content: `🎉 Successfully re-rolled! New winner(s): ${newWinners.map((w) => `<@${w}>`).join(', ')}`,
    });
  },
};
