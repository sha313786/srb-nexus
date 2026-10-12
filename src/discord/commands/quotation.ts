import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import { db } from '../../core/database';
import { logger } from '../../core/logger';

export const quotationCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-quotation')
    .setDescription('Website Creation & Development Quotation Hub')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Generate an official itemized website development quotation proposal')
        .addUserOption((opt) =>
          opt
            .setName('client')
            .setDescription('The client receiving the quotation')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('project_title')
            .setDescription('Project title or package name (e.g. Modern E-Commerce Storefront)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('price')
            .setDescription('Total project cost with currency (e.g. $750 USD or ₹35,000 INR)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('timeline')
            .setDescription('Turnaround timeframe (e.g. 14 Business Days or 3 Weeks)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('deliverables')
            .setDescription('Key features & deliverables (e.g. 5 Pages, Responsive UI, Stripe, Auth, Admin CMS)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('terms')
            .setDescription('Payment terms & warranty (e.g. 50% upfront, 50% on completion. 30 days free support.)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('intake')
        .setDescription('Post the Website Creation Quotation questionnaire card in this channel')
    )
    .addSubcommand((sub) =>
      sub
        .setName('estimate')
        .setDescription('Quick website cost estimator calculator')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Type of website')
            .setRequired(true)
            .addChoices(
              { name: 'Single Page Landing / Portfolio', value: 'landing' },
              { name: 'Standard Business Website (3-5 Pages)', value: 'business' },
              { name: 'Full E-Commerce Web Store', value: 'ecommerce' },
              { name: 'Custom Web Application / SaaS / Discord Dashboard', value: 'saas' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('tier')
            .setDescription('Complexity level')
            .setRequired(true)
            .addChoices(
              { name: 'Standard (Clean Design, Mobile Responsive, Contact Form)', value: 'standard' },
              { name: 'Advanced (Custom CMS, SEO Optimization, Dynamic Animations)', value: 'advanced' },
              { name: 'Enterprise (User Auth, Payment Gateways, API Integrations, Database)', value: 'enterprise' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      const clientUser = interaction.options.getUser('client', true);
      const projectTitle = interaction.options.getString('project_title', true);
      const price = interaction.options.getString('price', true);
      const timeline = interaction.options.getString('timeline', true);
      const deliverables = interaction.options.getString('deliverables', true);
      const terms = interaction.options.getString('terms') || '50% advance deposit to commence development, 50% balance upon final staging approval. Includes 30 days post-launch technical support.';

      const quoteId = `NX-Q${Date.now().toString().slice(-6)}`;

      // Update guild_tickets record if this is executed inside a ticket channel
      await db.query(
        `UPDATE guild_tickets 
         SET quote_amount = $1, quote_status = 'PROPOSED', project_type = $2, timeline = $3
         WHERE channel_id = $4`,
        [price, projectTitle, timeline, interaction.channelId]
      ).catch(() => {});

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`🌐 Official Website Creation Proposal — ${quoteId}`)
        .setDescription(
          `**Prepared By:** <@${interaction.user.id}>\n` +
          `**Prepared For:** <@${clientUser.id}>\n` +
          `**Project Package:** **${projectTitle}**\n\n` +
          `Here is your customized quotation and delivery schedule based on your specifications.`
        )
        .addFields(
          {
            name: '💵 Total Investment',
            value: `\`\`\`css\n${price}\n\`\`\``,
            inline: true,
          },
          {
            name: '⏱️ Estimated Delivery',
            value: `\`\`\`yaml\n${timeline}\n\`\`\``,
            inline: true,
          },
          {
            name: '📌 Status',
            value: `\`🟡 Awaiting Client Review\``,
            inline: true,
          },
          {
            name: '📦 Deliverables & Scope Breakdown',
            value: deliverables.split(',').map((item) => `• **${item.trim()}**`).join('\n') || deliverables,
            inline: false,
          },
          {
            name: '📜 Commercial Terms & Next Steps',
            value: terms,
            inline: false,
          }
        )
        .setFooter({ text: `SRB NEXUS Web Development Solutions • Reference: ${quoteId}` })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`nexus_quote_accept_${quoteId}`)
          .setLabel('Accept Quotation')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`nexus_quote_revise_${quoteId}`)
          .setLabel('Request Revision')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💬'),
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await interaction.reply({
        content: `🔔 <@${clientUser.id}>, your official website quotation is ready for review!`,
        embeds: [embed],
        components: [actionRow],
      });
      return;
    }

    if (subcommand === 'intake') {
      const embed = new EmbedBuilder()
        .setColor('#06B6D4')
        .setTitle('🌐 Website Creation & Development Inquiry')
        .setDescription(
          `Ready to build your new website or digital platform?\n\n` +
          `Click **Fill Quotation Form** below to provide your project requirements (type, pages, budget, timeline, and features). Our development team will review it and produce a tailored itemized quotation!`
        )
        .addFields(
          { name: '1. Project Scope', value: 'Landing pages, Full E-Commerce, Portfolios, SaaS apps & Dashboards.', inline: true },
          { name: '2. Modern Tech Stack', value: 'React / Next.js, Fastify / Node, TailwindCSS, PostgreSQL & Cloud hosting.', inline: true },
          { name: '3. What Happens Next?', value: 'An itemized proposal with cost & timeline will be presented directly in this ticket.', inline: false }
        )
        .setFooter({ text: 'SRB NEXUS Web Architecture Services' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_open_quote_modal')
          .setLabel('Fill Quotation Form')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
      return;
    }

    if (subcommand === 'estimate') {
      const type = interaction.options.getString('type', true);
      const tier = interaction.options.getString('tier', true);

      let baseMin = 150;
      let baseMax = 350;
      let days = '3 - 7 Days';
      let title = 'Single Page Landing / Portfolio';

      if (type === 'business') {
        baseMin = 350;
        baseMax = 800;
        days = '7 - 14 Days';
        title = 'Standard Business Website (3-5 Pages)';
      } else if (type === 'ecommerce') {
        baseMin = 750;
        baseMax = 1800;
        days = '14 - 25 Days';
        title = 'Full E-Commerce Web Store';
      } else if (type === 'saas') {
        baseMin = 1200;
        baseMax = 3000;
        days = '20 - 45 Days';
        title = 'Custom Web Application / SaaS / Discord Dashboard';
      }

      let multiplier = 1.0;
      if (tier === 'advanced') multiplier = 1.4;
      if (tier === 'enterprise') multiplier = 2.0;

      const estMinUSD = Math.round(baseMin * multiplier);
      const estMaxUSD = Math.round(baseMax * multiplier);
      const estMinINR = Math.round(estMinUSD * 85);
      const estMaxINR = Math.round(estMaxUSD * 85);

      const embed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle(`📊 Website Cost & Timeframe Estimate`)
        .setDescription(`Estimated cost benchmark for **${title}** (${tier.toUpperCase()} Tier):`)
        .addFields(
          {
            name: '💵 Estimated Range (USD)',
            value: `**$${estMinUSD.toLocaleString()} – $${estMaxUSD.toLocaleString()} USD**`,
            inline: true,
          },
          {
            name: '🇮🇳 Estimated Range (INR)',
            value: `**₹${estMinINR.toLocaleString()} – ₹${estMaxINR.toLocaleString()} INR**`,
            inline: true,
          },
          {
            name: '⏱️ Expected Turnaround',
            value: `**${days}**`,
            inline: true,
          },
          {
            name: '💡 How to Get an Exact Quote',
            value: `Click **Request Exact Quotation** below or open a ticket to submit your detailed project scope.`,
            inline: false,
          }
        )
        .setFooter({ text: 'SRB NEXUS Instant Cost Calculator' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_open_quote_modal')
          .setLabel('Request Exact Quotation')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💼')
      );

      await interaction.reply({
        embeds: [embed],
        components: [row],
      });
      return;
    }
  },
};
