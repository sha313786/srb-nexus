import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export function startBackgroundSchedulers(bot: Client) {
  logger.info('[CRON] Initializing background Giveaways and Reminders schedulers...');

  // Run every 10 seconds
  setInterval(async () => {
    await processExpiredGiveaways(bot);
    await processDueReminders(bot);
  }, 10000);
}

async function processExpiredGiveaways(bot: Client) {
  try {
    const res = await db.query(
      `SELECT * FROM giveaways WHERE ended = FALSE AND ends_at <= CURRENT_TIMESTAMP`
    );

    for (const giveaway of res.rows) {
      try {
        const entries: string[] = giveaway.entries || [];
        const winnerCount = Math.min(giveaway.winner_count || 1, entries.length);

        let winners: string[] = [];
        if (entries.length > 0) {
          const shuffled = [...entries].sort(() => Math.random() - 0.5);
          winners = shuffled.slice(0, winnerCount);
        }

        // Mark as ended in DB
        await db.query(
          `UPDATE giveaways SET ended = TRUE, winners = $1 WHERE id = $2`,
          [winners, giveaway.id]
        );

        // Fetch channel and message in Discord
        const channel = (await bot.channels.fetch(giveaway.channel_id).catch(() => null)) as TextChannel;
        if (!channel || !channel.isTextBased()) continue;

        const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);

        const winnerMentions = winners.length > 0
          ? winners.map((w) => `<@${w}>`).join(', ')
          : 'No eligible entries';

        if (message) {
          const endedEmbed = new EmbedBuilder()
            .setColor('#64748B')
            .setTitle(`🎉 [ENDED] GIVEAWAY: ${giveaway.prize}`)
            .setDescription(
              `This giveaway has officially concluded!\n\n` +
              `🏆 **Winner(s):** ${winnerMentions}\n` +
              `👤 **Hosted by:** <@${giveaway.host_id}>\n` +
              `🎟️ **Total Entries:** ${entries.length}`
            )
            .setFooter({ text: 'SRB NEXUS Giveaway Concluded' })
            .setTimestamp();

          const disabledButton = new ButtonBuilder()
            .setCustomId('giveaway_ended')
            .setLabel(`Giveaway Ended (${entries.length} entries)`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

          await message.edit({ embeds: [endedEmbed], components: [row] }).catch(() => null);
        }

        // Post announcement
        if (winners.length > 0) {
          await channel.send({
            content: `🎉 **GIVEAWAY CONCLUDED!**\nCongratulations ${winnerMentions}! You won **${giveaway.prize}**! 🎁`,
          }).catch(() => null);
        } else {
          await channel.send({
            content: `😢 Giveaway for **${giveaway.prize}** ended with no eligible participants.`,
          }).catch(() => null);
        }

        logger.info(`[CRON] Processed expired giveaway id ${giveaway.id} (${giveaway.prize})`);
      } catch (err) {
        logger.error({ err, giveawayId: giveaway.id }, '[CRON] Error processing giveaway');
      }
    }
  } catch (err) {
    logger.error({ err }, '[CRON] Failed to poll giveaways');
  }
}

async function processDueReminders(bot: Client) {
  try {
    const res = await db.query(
      `SELECT * FROM user_reminders WHERE completed = FALSE AND remind_at <= CURRENT_TIMESTAMP`
    );

    for (const reminder of res.rows) {
      try {
        await db.query(
          `UPDATE user_reminders SET completed = TRUE WHERE id = $1`,
          [reminder.id]
        );

        let sent = false;

        // Try sending in original channel
        const channel = (await bot.channels.fetch(reminder.channel_id).catch(() => null)) as TextChannel;
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setColor('#38BDF8')
            .setTitle('⏰ Scheduled Reminder Alert')
            .setDescription(`Hey <@${reminder.user_id}>, you asked me to remind you about:\n\n**${reminder.reminder_text}**`)
            .setFooter({ text: 'SRB NEXUS Reminder' })
            .setTimestamp();

          await channel.send({
            content: `<@${reminder.user_id}>`,
            embeds: [embed],
          }).then(() => { sent = true; }).catch(() => null);
        }

        // If channel failed or channel deleted, try DM
        if (!sent) {
          const user = await bot.users.fetch(reminder.user_id).catch(() => null);
          if (user) {
            await user.send({
              content: `⏰ **Scheduled Reminder:** Hey! You asked me to remind you: **${reminder.reminder_text}**`,
            }).catch(() => null);
          }
        }

        logger.info(`[CRON] Dispatched reminder id ${reminder.id} for user ${reminder.user_id}`);
      } catch (err) {
        logger.error({ err, reminderId: reminder.id }, '[CRON] Error dispatching reminder');
      }
    }
  } catch (err) {
    logger.error({ err }, '[CRON] Failed to poll reminders');
  }
}
