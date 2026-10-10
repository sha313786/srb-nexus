import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
  ColorResolvable,
} from 'discord.js';

export const embedCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-embed')
    .setDescription('Broadcast a customized rich embed announcement to any channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) =>
      opt.setName('title').setDescription('Title for the embed announcement').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('description').setDescription('Main text content (supports markdown and emojis)').setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Target channel (default: current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('color').setDescription('Hex color code (e.g. #6366F1, #10B981, #EF4444)').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('thumbnail').setDescription('Thumbnail image URL').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('footer').setDescription('Custom footer text').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const targetChannel = (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
    const colorHex = interaction.options.getString('color') || '#6366F1';
    const thumbnail = interaction.options.getString('thumbnail');
    const footerText = interaction.options.getString('footer');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description.replace(/\\n/g, '\n'))
      .setAuthor({
        name: interaction.guild.name,
        iconURL: interaction.guild.iconURL() || undefined,
      })
      .setTimestamp();

    try {
      embed.setColor(colorHex as ColorResolvable);
    } catch {
      embed.setColor('#6366F1');
    }

    if (thumbnail) {
      embed.setThumbnail(thumbnail);
    }

    if (footerText) {
      embed.setFooter({ text: footerText });
    } else {
      embed.setFooter({ text: `Posted by ${interaction.user.tag}` });
    }

    try {
      await targetChannel.send({ embeds: [embed] });
      return interaction.reply({
        content: `✅ Embed successfully broadcast to <#${targetChannel.id}>!`,
        ephemeral: true,
      });
    } catch (err: any) {
      return interaction.reply({
        content: `❌ Failed to broadcast embed: ${err.message}`,
        ephemeral: true,
      });
    }
  },
};
