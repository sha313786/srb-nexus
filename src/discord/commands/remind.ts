import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../../core/database';

function parseDuration(durationStr: string): number | null {
  const match = durationStr.match(/^(\d+)([smhd])$/i);
  if (!match) return null;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

export const remindCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-remind')
    .setDescription('Set an automated timed reminder with notification')
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('When to remind you (e.g. 10m, 2h, 1d)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('note').setDescription('What should I remind you about?').setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const durationStr = interaction.options.getString('duration', true);
    const note = interaction.options.getString('note', true);

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 5000 || durationMs > 365 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Invalid duration! Please provide a valid duration between `10s` and `365d` (e.g. `15m`, `3h`, `1d`).',
        ephemeral: true,
      });
    }

    const remindAt = new Date(Date.now() + durationMs);
    const remindTimestamp = Math.floor(remindAt.getTime() / 1000);

    await db.query(
      `INSERT INTO user_reminders (guild_id, user_id, channel_id, reminder_text, remind_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [interaction.guild.id, interaction.user.id, interaction.channelId, note, remindAt]
    );

    const embed = new EmbedBuilder()
      .setColor('#38BDF8')
      .setTitle('⏰ Reminder Scheduled')
      .setDescription(`I will remind you about: **${note}**\n\nTriggering <t:${remindTimestamp}:R> (<t:${remindTimestamp}:f>)`)
      .setFooter({ text: 'SRB NEXUS Reminder Engine' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
