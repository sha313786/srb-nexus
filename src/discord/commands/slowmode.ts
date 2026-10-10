import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';

export const slowmodeCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-slowmode')
    .setDescription('Sets the slowmode rate limit for a channel')
    .addIntegerOption((opt) => opt.setName('seconds').setDescription('Slowmode delay in seconds (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to apply to (default: current)').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const seconds = interaction.options.getInteger('seconds', true);
    const targetChannel = (interaction.options.getChannel('channel') || interaction.channel) as TextChannel;

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: '❌ Slowmode can only be applied to text channels.', ephemeral: true });
      return;
    }

    await targetChannel.setRateLimitPerUser(seconds);

    if (seconds === 0) {
      await interaction.reply({ content: `✅ Slowmode disabled in ${targetChannel}.` });
    } else {
      await interaction.reply({ content: `⏱️ Slowmode set to \`${seconds} seconds\` in ${targetChannel}.` });
    }
  },
};
