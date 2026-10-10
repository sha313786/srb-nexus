import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  TextChannel,
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

export const giveawayCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-giveaway')
    .setDescription('Launch a real-time interactive giveaway with automated countdown and winners')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt.setName('prize').setDescription('Prize being given away (e.g. Discord Nitro, Steam Key)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Duration (e.g. 10m, 2h, 1d)').setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('winners').setDescription('Number of winners (default: 1)').setMinValue(1).setMaxValue(20).setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to host the giveaway in (default: current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const prize = interaction.options.getString('prize', true);
    const durationStr = interaction.options.getString('duration', true);
    const winners = interaction.options.getInteger('winners') || 1;
    const targetChannel = (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);

    const durationMs = parseDuration(durationStr);
    if (!durationMs || durationMs < 10000 || durationMs > 30 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: '❌ Invalid duration! Please provide a valid duration between `10s` and `30d` (e.g. `10m`, `2h`, `1d`).',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const endsAt = new Date(Date.now() + durationMs);
    const endTimestamp = Math.floor(endsAt.getTime() / 1000);

    const embed = new EmbedBuilder()
      .setColor('#EC4899')
      .setTitle(`🎉 GIVEAWAY: ${prize}`)
      .setDescription(
        `Click the **Enter Giveaway** button below to participate!\n\n` +
        `🏆 **Winners:** ${winners}\n` +
        `⏳ **Ends:** <t:${endTimestamp}:R> (<t:${endTimestamp}:f>)\n` +
        `👤 **Hosted by:** <@${interaction.user.id}>`
      )
      .setFooter({ text: 'SRB NEXUS Giveaway Engine' })
      .setTimestamp(endsAt);

    const enterButton = new ButtonBuilder()
      .setCustomId('nexus_giveaway_enter')
      .setLabel('🎉 Enter Giveaway (0)')
      .setStyle(ButtonStyle.Success);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(enterButton);

    const giveawayMsg = await targetChannel.send({
      embeds: [embed],
      components: [row],
    });

    await db.query(
      `INSERT INTO giveaways (guild_id, channel_id, message_id, prize, winner_count, ends_at, host_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [interaction.guild.id, targetChannel.id, giveawayMsg.id, prize, winners, endsAt, interaction.user.id]
    );

    return interaction.editReply({
      content: `🎉 Giveaway launched successfully in <#${targetChannel.id}>! [Jump to Giveaway](${giveawayMsg.url})`,
    });
  },
};
