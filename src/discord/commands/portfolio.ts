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
  ForumChannel,
} from 'discord.js';

export const portfolioCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-portfolio')
    .setDescription('Publish a modern project showcase card to #💼・portfolio')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('Project title (e.g. Digital Den 360, Nexus Dashboard)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Project category (e.g. Full-Stack Web App, Discord Bot, UI/UX, SaaS)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('description')
        .setDescription('Overview of what was built and the problem it solved')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('live_url')
        .setDescription('Live demo or website URL (adds a Visit Live Demo button)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('image_url')
        .setDescription('Screenshot or Mockup image URL (e.g. shots.so mockup, Discord CDN)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('highlights')
        .setDescription('Key features or achievements (e.g. Mobile-First, Stripe Checkout)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to post in (defaults to #💼・portfolio)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    if (interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ The `/nexus-portfolio` showcase system is exclusively configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString('title', true);
    const category = interaction.options.getString('category', true);
    const description = interaction.options.getString('description', true);
    const liveUrl = interaction.options.getString('live_url');
    const imageUrl = interaction.options.getString('image_url');
    const highlightsRaw = interaction.options.getString('highlights');
    const customChannel = interaction.options.getChannel('channel') as TextChannel | ForumChannel | null;

    // Resolve portfolio channel
    let targetChan: any = customChannel;
    if (!targetChan) {
      targetChan = interaction.guild.channels.cache.find(
        (c) => c.name.includes('portfolio')
      );
    }

    if (!targetChan) {
      await interaction.editReply({
        content: '❌ Could not find the **#💼・portfolio** channel. Please specify a channel option.',
      });
      return;
    }

    // Format highlights
    let formattedHighlights = '';
    if (highlightsRaw) {
      formattedHighlights = highlightsRaw
        .split(/[,|\n]/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0)
        .map((h) => `• ${h}`)
        .join('\n');
    }

    // Build the showcase embed
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `${interaction.guild.name.toUpperCase()} ✦ FEATURED CASE STUDY`,
        iconURL: interaction.guild.iconURL() || undefined,
      })
      .setTitle(`🚀 ${title} • ${category}`)
      .setColor('#00E5FF')
      .setDescription(
        `**📝 Project Overview:**\n${description}\n\n` +
        (formattedHighlights ? `**⭐ Key Deliverables & Highlights:**\n${formattedHighlights}\n\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 *Interested in a similar build? Click **Request Similar Project** below to get an instant quotation!*`
      )
      .setFooter({
        text: 'SRB Studio • Quality & High-Performance Engineering',
        iconURL: interaction.client.user?.displayAvatarURL() || undefined,
      })
      .setTimestamp();

    if (imageUrl) {
      embed.setImage(imageUrl);
    }

    // Build Action Buttons (Never include private repository URLs)
    const buttons: ButtonBuilder[] = [];

    if (liveUrl && /^https?:\/\//i.test(liveUrl)) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Visit Live Demo')
          .setEmoji('🔗')
          .setStyle(ButtonStyle.Link)
          .setURL(liveUrl)
      );
    }

    // Lead generation button to open quote modal
    buttons.push(
      new ButtonBuilder()
        .setCustomId('nexus_quote_ticket_create')
        .setLabel('Request Similar Project')
        .setEmoji('💡')
        .setStyle(ButtonStyle.Success)
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    try {
      if (targetChan.type === ChannelType.GuildForum) {
        const forum = targetChan as ForumChannel;
        const tag = forum.availableTags.find((t) =>
          category.toLowerCase().includes(t.name.toLowerCase()) ||
          t.name.toLowerCase().includes(category.toLowerCase())
        );
        const appliedTags = tag ? [tag.id] : [];

        const thread = await forum.threads.create({
          name: `${title} — ${category}`.slice(0, 100),
          appliedTags,
          message: {
            content: `🚀 **${title}** — Featured Project Case Study`,
            embeds: [embed],
            components: [actionRow],
          },
        });

        await interaction.editReply({
          content: `🎉 **Project Published Successfully!**\n\nYour case study **${title}** is now live in ${targetChan} under thread **${thread.name}**.\n🔗 [View Showcase Thread](${thread.url})`,
        });
        return;
      }

      const message = await targetChan.send({
        embeds: [embed],
        components: [actionRow],
      });

      await interaction.editReply({
        content: `🎉 **Project Published Successfully!**\n\nYour case study **${title}** is now live in ${targetChan}.\n🔗 [View Showcase Post](${message.url})`,
      });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ Failed to publish project: ${err.message || 'Check bot permissions in portfolio channel.'}`,
      });
    }
  },
};
