import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { db } from '../../core/database';

export const afkCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-afk')
    .setDescription('Set your status to AFK (Away From Keyboard) with an optional reason')
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for being away (default: AFK)').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const reason = interaction.options.getString('reason') || 'AFK (Away from Keyboard)';

    await db.query(
      `INSERT INTO user_afk (guild_id, user_id, reason, afk_since)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET reason = EXCLUDED.reason, afk_since = CURRENT_TIMESTAMP`,
      [interaction.guild.id, interaction.user.id, reason]
    );

    const embed = new EmbedBuilder()
      .setColor('#F59E0B')
      .setTitle('💤 AFK Status Set')
      .setDescription(`<@${interaction.user.id}> is now **AFK**.\n\n📝 **Reason:** *${reason}*\n\n*I will notify anyone who mentions you and automatically remove your AFK status when you speak next.*`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
