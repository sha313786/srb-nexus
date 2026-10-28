// Path: src/discord/commands/ticket.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { db } from '../../core/database';
import { broadcastLiveNotification } from '../../services/liveNotifications';
import { archiveAndSendTicketTranscript } from '../../services/transcriptService';

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket')
    .setDescription('Manage support, project inquiry, and website quotation tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName('deploy-panels')
        .setDescription('Automatically deploy both Project Inquiry and Website Quotation panels to server channels')
    )
    .addSubcommand((sub) =>
      sub
        .setName('deploy-inquiry')
        .setDescription('Deploy the Project Inquiry intake panel to a target channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target channel (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('deploy-quote')
        .setDescription('Deploy the Website Creation Quotation panel to a target channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target channel (defaults to current channel)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('quote-form')
        .setDescription('Post the Website Creation Quotation questionnaire in this ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('inquiry-form')
        .setDescription('Post the Project Inquiry questionnaire in this ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close and archive this ticket channel')
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user or collaborator to this ticket channel')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename this ticket channel')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('New channel name')
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const channel = interaction.channel as TextChannel;

    if (!guild || !channel) {
      await interaction.reply({ content: 'This command can only be used in a server channel.', ephemeral: true });
      return;
    }

    const studioOnlySubcommands = ['deploy-panels', 'deploy-inquiry', 'deploy-quote', 'quote-form', 'inquiry-form'];
    if (studioOnlySubcommands.includes(subcommand) && interaction.guildId !== '1525065834572021851') {
      await interaction.reply({
        content: '❌ Project inquiry and quotation commands are exclusively configured for **SRB Studio**.',
        ephemeral: true,
      });
      return;
    }

    // Safety & permission check for ticket channel management subcommands
    if (['close', 'add', 'remove', 'rename'].includes(subcommand)) {
      const isTicketChannel =
        channel.name.startsWith('ticket-') ||
        channel.name.startsWith('quote-') ||
        channel.name.startsWith('inquiry-') ||
        channel.name.startsWith('client-') ||
        channel.name.startsWith('🔒');

      const ticketDb = await db.query(
        `SELECT user_id FROM guild_tickets WHERE channel_id = $1`,
        [channel.id]
      ).catch(() => null);

      if (!isTicketChannel && (!ticketDb || ticketDb.rows.length === 0)) {
        await interaction.reply({
          content: '❌ This command can only be used inside an active ticket channel.',
          ephemeral: true,
        });
        return;
      }

      const member = interaction.member as any;
      const settingsRes = await db.query(
        `SELECT support_role_id FROM guild_settings WHERE guild_id = $1`,
        [guild.id]
      ).catch(() => null);
      const supportRoleId = settingsRes?.rows?.[0]?.support_role_id;

      const isStaff =
        member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has(PermissionFlagsBits.ManageChannels) ||
        (supportRoleId && member?.roles?.cache?.has(supportRoleId)) ||
        (guild.id === '1525065834572021851' && member?.roles?.cache?.has('1525111410651041973'));

      const isTicketOwner = ticketDb?.rows?.[0]?.user_id === interaction.user.id;

      if (!isStaff && !isTicketOwner) {
        await interaction.reply({
          content: '❌ Only support staff or the ticket creator can manage this ticket.',
          ephemeral: true,
        });
        return;
      }
    }

    // 1. AUTO DEPLOY BOTH PANELS
    if (subcommand === 'deploy-panels') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: 'You need Manage Channels permissions to deploy ticket panels.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      // Find Project Inquiry target channel (look for project-inquiry or enquiry-ticket)
      const inquiryChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && (c.name.includes('project-inquiry') || c.name.includes('enquiry-ticket'))
      ) as TextChannel | undefined;

      // Find Quotation target channel (look for request-a-quote or quotation-ticket)
      const quoteChannel = guild.channels.cache.find(
        (c) => c.isTextBased() && (c.name.includes('request-a-quote') || c.name.includes('quotation-ticket'))
      ) as TextChannel | undefined;

      const deployed: string[] = [];

      // Deploy Project Inquiry Panel
      if (inquiryChannel) {
        const inqEmbed = new EmbedBuilder()
          .setColor('#06B6D4')
          .setTitle('📩 SRB NEXUS — Project Inquiry Desk')
          .setDescription(
            `Have a new project idea, custom development requirement, or questions for our team?\n\n` +
            `Click **Open Project Inquiry** below to fill out our intake form. A private channel will be generated for you under **Support Center** with our staff.`
          )
          .addFields(
            { name: '1. What We Handle', value: 'Websites, Discord Bots, Software Development, UI/UX & Cloud Hosting.', inline: true },
            { name: '2. Dedicated Workspace', value: 'Private discussions, file sharing, and direct developer access.', inline: true }
          )
          .setFooter({ text: 'SRB NEXUS Client Relations • Automated Inquiry System' })
          .setTimestamp();

        const inqRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('nexus_inquiry_ticket_create')
            .setLabel('Open Project Inquiry')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📩')
        );

        await inquiryChannel.send({ embeds: [inqEmbed], components: [inqRow] }).catch(() => {});
        deployed.push(`📩 Project Inquiry Panel -> ${inquiryChannel}`);
      }

      // Deploy Website Quotation Panel
      if (quoteChannel) {
        const quoteEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📝 Website Creation & Development Quotation')
          .setDescription(
            `Ready to bring your digital vision to life? Whether you need a high-converting Landing Page, full E-Commerce store, or custom SaaS web app, our team is ready!\n\n` +
            `Click **Request a Quote** below to submit your project requirements and receive a free, itemized quotation proposal.`
          )
          .addFields(
            { name: '1. Project Scope', value: 'Landing Pages, Corporate Portals, E-Commerce, Custom Web Apps & Dashboards.', inline: true },
            { name: '2. Transparent Pricing', value: 'Clear milestones, delivery timeline, and post-launch support.', inline: true }
          )
          .setFooter({ text: 'SRB NEXUS Web Architecture Services • Quotation Desk' })
          .setTimestamp();

        const quoteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('nexus_quote_ticket_create')
            .setLabel('Request a Quote')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📝')
        );

        await quoteChannel.send({ embeds: [quoteEmbed], components: [quoteRow] }).catch(() => {});
        deployed.push(`📝 Website Quotation Panel -> ${quoteChannel}`);
      }

      if (deployed.length > 0) {
        await interaction.editReply({
          content: `✅ Successfully deployed ticket panels:\n${deployed.join('\n')}\n\n*All newly created tickets will be automatically organized under the **Support Center** category.*`,
        });
      } else {
        await interaction.editReply({
          content: `⚠️ Could not find matching channels. Use \`/nexus-ticket deploy-inquiry\` or \`/nexus-ticket deploy-quote\` with a specific channel.`,
        });
      }
      return;
    }

    // 2. DEPLOY SINGLE INQUIRY PANEL
    if (subcommand === 'deploy-inquiry') {
      const targetChan = (interaction.options.getChannel('channel') as TextChannel) || channel;

      const inqEmbed = new EmbedBuilder()
        .setColor('#06B6D4')
        .setTitle('📩 SRB NEXUS — Project Inquiry Desk')
        .setDescription(
          `Have a new project idea, custom development requirement, or questions for our team?\n\n` +
          `Click **Open Project Inquiry** below to fill out our intake form. A private channel will be arranged for you under **Support Center** with our staff.`
        )
        .addFields(
          { name: '1. Scope', value: 'Websites, Bots, Custom Software & Infrastructure.', inline: true },
          { name: '2. Turnaround', value: 'Prompt response from our project managers.', inline: true }
        )
        .setFooter({ text: 'SRB NEXUS Client Relations • Automated Inquiry System' })
        .setTimestamp();

      const inqRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_inquiry_ticket_create')
          .setLabel('Open Project Inquiry')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩')
      );

      await targetChan.send({ embeds: [inqEmbed], components: [inqRow] });
      await interaction.reply({ content: `✅ Project Inquiry panel deployed to ${targetChan}!`, ephemeral: true });
      return;
    }

    // 3. DEPLOY SINGLE QUOTATION PANEL
    if (subcommand === 'deploy-quote') {
      const targetChan = (interaction.options.getChannel('channel') as TextChannel) || channel;

      const quoteEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📝 Website Creation & Development Quotation')
        .setDescription(
          `Need a custom website, web app, or e-commerce platform? Click below to submit your project requirements and receive an itemized proposal from our development team.`
        )
        .addFields(
          { name: '1. Project Scope', value: 'Landing Pages, Corporate Portals, E-Commerce, Custom Web Apps & Dashboards.', inline: true },
          { name: '2. Transparent Pricing', value: 'Clear milestones, delivery timeline, and post-launch support.', inline: true }
        )
        .setFooter({ text: 'SRB NEXUS Web Architecture Services • Quotation Desk' })
        .setTimestamp();

      const quoteRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_quote_ticket_create')
          .setLabel('Request a Quote')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📝')
      );

      await targetChan.send({ embeds: [quoteEmbed], components: [quoteRow] });
      await interaction.reply({ content: `✅ Website Quotation panel deployed to ${targetChan}!`, ephemeral: true });
      return;
    }

    // 4. QUOTE FORM QUESTIONNAIRE IN CURRENT TICKET
    if (subcommand === 'quote-form') {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🌐 Website Creation & Development Quotation Intake')
        .setDescription(
          `Please provide your website project specifications below so our development team can calculate an accurate, itemized quotation.\n\n` +
          `Click **Fill Quotation Form** to submit your website type, page count, target budget, and required features.`
        )
        .addFields(
          { name: '1. Project Type', value: 'E-Commerce, Corporate Site, Portfolio, Web App / SaaS, Custom API.', inline: true },
          { name: '2. Commercials', value: 'Itemized milestone breakdown with transparent pricing and timeline.', inline: true },
          { name: '3. Turnaround', value: 'Fast turnaround with continuous previews and responsive design.', inline: true }
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

    // 5. INQUIRY FORM IN CURRENT TICKET
    if (subcommand === 'inquiry-form') {
      const embed = new EmbedBuilder()
        .setColor('#06B6D4')
        .setTitle('📩 Project Inquiry Intake')
        .setDescription(
          `Please share details about your project inquiry below so our team can assist you.\n\n` +
          `Click **Fill Inquiry Form** to state your project goals, scope, and urgency.`
        )
        .setFooter({ text: 'SRB NEXUS Client Relations' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_open_inquiry_modal')
          .setLabel('Fill Inquiry Form')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩'),
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

    // 6. CLOSE TICKET
    if (subcommand === 'close') {
      await interaction.reply({
        content: '🔒 Ticket acknowledged. Generating transcript archive and closing channel in 5 seconds...',
      });

      // Archive and send transcript to transcript channel and client DM
      await archiveAndSendTicketTranscript(guild, channel, interaction.user);

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 5000);
      return;
    }

    // 7. ADD USER
    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user', true);
      await channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      });

      await interaction.reply({
        content: `✅ Successfully added <@${targetUser.id}> to this ticket channel.`,
      });
      return;
    }

    // 8. REMOVE USER
    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user', true);
      await channel.permissionOverwrites.delete(targetUser.id);

      await interaction.reply({
        content: `🚫 Successfully removed <@${targetUser.id}> from this ticket channel.`,
      });
      return;
    }

    // 9. RENAME TICKET
    if (subcommand === 'rename') {
      const newName = interaction.options.getString('name', true).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
      await channel.setName(newName);

      await interaction.reply({
        content: `📝 Ticket channel renamed to \`#${newName}\`.`,
      });
      return;
    }
  },
};