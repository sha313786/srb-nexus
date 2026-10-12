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

export const portfolioCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-portfolio')
    .setDescription('Publish a modern project showcase card to #💼・portfolio')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((opt) =>
      opt
        .setName('title')
        .setDescription('Project title (e.g. Apex E-Commerce, Nexus Dashboard)')
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
        .setName('tech_stack')
        .setDescription('Technologies used (e.g. Next.js 14, Tailwind CSS, PostgreSQL, Stripe)')
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
        .setName('github_url')
        .setDescription('GitHub repository or Case study URL')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('highlights')
        .setDescription('Key features or achievements (e.g. 99 Lighthouse, Mobile-First, Stripe Checkout)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to post in (defaults to #💼・portfolio)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString('title', true);
    const category = interaction.options.getString('category', true);
    const techStackRaw = interaction.options.getString('tech_stack', true);
    const description = interaction.options.getString('description', true);
    const liveUrl = interaction.options.getString('live_url');
    const imageUrl = interaction.options.getString('image_url');
    const githubUrl = interaction.options.getString('github_url');
    const highlightsRaw = interaction.options.getString('highlights');
    const customChannel = interaction.options.getChannel('channel') as TextChannel | null;

    // Resolve portfolio channel
    let targetChan: TextChannel | null = customChannel;
    if (!targetChan) {
      targetChan = interaction.guild.channels.cache.find(
        (c) => c.isTextBased() && c.name.includes('portfolio')
      ) as TextChannel;
    }

    if (!targetChan || !targetChan.isTextBased()) {
      await interaction.editReply({
        content: '❌ Could not find the **#💼・portfolio** channel. Please specify a channel option.',
      });
      return;
    }

    // Format tech stack badges
    const formattedTech = techStackRaw
      .split(/[,|•]/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => `\`${t}\``)
      .join(' • ');

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
        `**🛠️ Tech Stack:**\n${formattedTech}\n\n` +
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

    // Build Action Buttons
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

    if (githubUrl && /^https?:\/\//i.test(githubUrl)) {
      buttons.push(
        new ButtonBuilder()
          .setLabel('Repository')
          .setEmoji('📂')
          .setStyle(ButtonStyle.Link)
          .setURL(githubUrl)
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
