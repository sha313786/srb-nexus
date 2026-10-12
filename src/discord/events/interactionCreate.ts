import {
  Interaction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { commandRegistry } from '../commands';
import { logger } from '../../core/logger';
import { db } from '../../core/database';
import { broadcastLiveNotification } from '../../services/liveNotifications';

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  // 1. HANDLE SLASH COMMANDS
  if (interaction.isChatInputCommand()) {
    const command = commandRegistry.get(interaction.commandName);

    if (!command) {
      logger.warn(`[BOT] Command implementation missing for /${interaction.commandName}`);
      await interaction.reply({
        content: `Command \`/${interaction.commandName}\` is registered but not implemented in code.`,
        ephemeral: true,
      });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error({ err, commandName: interaction.commandName }, 'Error executing slash command');
      const errorMessage = 'An error occurred while executing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      }
    }
    return;
  }

  // 2. HANDLE TICKET DROPDOWN SELECTION
  if (interaction.isStringSelectMenu() && interaction.customId === 'nexus_ticket_select') {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      await interaction.deferReply({ ephemeral: true });

      const category = interaction.values[0] || 'support';
      const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16) || 'member';
      const userTag = interaction.user.discriminator && interaction.user.discriminator !== '0'
        ? interaction.user.discriminator
        : interaction.user.id.slice(-4);
      const channelName = `ticket-${category}-${cleanName}-${userTag}`;

      // Check for existing open ticket for this user
      const existingTicket = await db.query(
        `SELECT channel_id FROM guild_tickets WHERE guild_id = $1 AND user_id = $2 AND status = 'OPEN' LIMIT 1`,
        [guild.id, interaction.user.id]
      ).catch(() => null);

      if (existingTicket && existingTicket.rows.length > 0) {
        const existingChannel = guild.channels.cache.get(existingTicket.rows[0].channel_id) ||
          await guild.channels.fetch(existingTicket.rows[0].channel_id).catch(() => null);
        if (existingChannel) {
          await interaction.editReply({
            content: `⚠️ You already have an active ticket channel: ${existingChannel}`,
          });
          return;
        }
      }

      // Query guild ticket settings
      const settingsRes = await db.query(
        `SELECT support_role_id, ticket_category_id FROM guild_settings WHERE guild_id = $1`,
        [guild.id]
      ).catch(() => null);

      const supportRoleId = settingsRes?.rows?.[0]?.support_role_id;
      const categoryId = settingsRes?.rows?.[0]?.ticket_category_id;

      const permissionOverwrites: any[] = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ];

      const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
      if (botMember) {
        permissionOverwrites.push({
          id: botMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
          ],
        });
      }

      if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
        permissionOverwrites.push({
          id: supportRoleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        });
      }

      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId && guild.channels.cache.has(categoryId) ? categoryId : undefined,
        permissionOverwrites,
      });

      // Track in database
      await db.query(
        `INSERT INTO guild_tickets (guild_id, channel_id, user_id, status)
         VALUES ($1, $2, $3, 'OPEN')`,
        [guild.id, ticketChannel.id, interaction.user.id]
      ).catch(() => {});

      const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 Support Ticket: ${category.toUpperCase()}`)
        .setDescription(`Hello <@${interaction.user.id}>! A staff member has been notified and will assist you shortly.\n\nClick **Close Ticket** below when your inquiry is resolved.`)
        .setColor('#5865F2')
        .setTimestamp();

      await ticketChannel.send({
        content: supportRoleId ? `<@${interaction.user.id}> | <@&${supportRoleId}>` : `<@${interaction.user.id}>`,
        embeds: [welcomeEmbed],
        components: [closeRow],
      });

      await interaction.editReply({
        content: `✅ Your ticket channel has been opened: ${ticketChannel}`,
      });

      broadcastLiveNotification(interaction.client, guild.id, {
        type: 'ticket',
        title: `Support Ticket Opened: ${category.toUpperCase()}`,
        description: `New ticket created by <@${interaction.user.id}> (${interaction.user.username}) in ${ticketChannel}`,
        severity: 'info',
        fields: [
          { name: 'Category', value: category.toUpperCase(), inline: true },
          { name: 'Created By', value: `<@${interaction.user.id}>`, inline: true },
        ],
      }).catch(() => {});
    } catch (err) {
      logger.error({ err }, 'Failed to create ticket channel');
      if (interaction.deferred) {
        await interaction.editReply({ content: 'Failed to create ticket channel. Please check bot permissions.' });
      }
    }
    return;
  }

  // 3. HANDLE TICKET / QUOTATION MODAL INVOCATION
  if (
    interaction.isButton() &&
    (interaction.customId === 'nexus_ticket_create' ||
      interaction.customId === 'nexus_create_ticket' ||
      interaction.customId === 'nexus_open_quote_modal')
  ) {
    const modal = new ModalBuilder()
      .setCustomId('nexus_quote_modal')
      .setTitle('Website Quotation Request');

    const typeInput = new TextInputBuilder()
      .setCustomId('website_type')
      .setLabel('Website Type / Category')
      .setPlaceholder('e.g. E-Commerce, Portfolio, SaaS, Business Website')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const pagesInput = new TextInputBuilder()
      .setCustomId('website_pages')
      .setLabel('Estimated Pages & Deliverables')
      .setPlaceholder('e.g. 5 Pages, Landing Page, Blog, Customer Portal')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const budgetInput = new TextInputBuilder()
      .setCustomId('target_budget')
      .setLabel('Target Budget & Currency')
      .setPlaceholder('e.g. $500 - $1,500 USD / ₹30,000 INR / Flexible')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const timelineInput = new TextInputBuilder()
      .setCustomId('target_timeline')
      .setLabel('Desired Timeline / Deadline')
      .setPlaceholder('e.g. 10 Days, 3 Weeks, Urgent')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const detailsInput = new TextInputBuilder()
      .setCustomId('project_details')
      .setLabel('Key Features, Scope & References')
      .setPlaceholder('Describe features (e.g. Stripe checkout, Discord auth, SEO) or link design references...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(pagesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(budgetInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timelineInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // 3b. HANDLE WEBSITE QUOTATION MODAL SUBMISSION
  if (interaction.isModalSubmit() && interaction.customId === 'nexus_quote_modal') {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      await interaction.deferReply({ ephemeral: true });

      const websiteType = interaction.fields.getTextInputValue('website_type');
      const websitePages = interaction.fields.getTextInputValue('website_pages');
      const targetBudget = interaction.fields.getTextInputValue('target_budget');
      const targetTimeline = interaction.fields.getTextInputValue('target_timeline') || 'Flexible';
      const projectDetails = interaction.fields.getTextInputValue('project_details');

      const currentChanName = (interaction.channel as any)?.name || '';
      const isCurrentChannelTicket = currentChanName.startsWith('ticket-') || currentChanName.startsWith('quote-');

      let targetChannel: any = null;

      if (isCurrentChannelTicket) {
        targetChannel = interaction.channel;
        await db.query(
          `UPDATE guild_tickets 
           SET ticket_type = 'WEBSITE_QUOTATION', project_type = $1, budget = $2, timeline = $3, pages = $4, details = $5
           WHERE channel_id = $6`,
          [websiteType, targetBudget, targetTimeline, websitePages, projectDetails, targetChannel.id]
        ).catch(() => {});
      } else {
        const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 14) || 'client';
        const userTag = interaction.user.discriminator && interaction.user.discriminator !== '0'
          ? interaction.user.discriminator
          : interaction.user.id.slice(-4);
        const channelName = `quote-${cleanName}-${userTag}`;

        const settingsRes = await db.query(
          `SELECT support_role_id, ticket_category_id FROM guild_settings WHERE guild_id = $1`,
          [guild.id]
        ).catch(() => null);

        const supportRoleId = settingsRes?.rows?.[0]?.support_role_id;
        const categoryId = settingsRes?.rows?.[0]?.ticket_category_id;

        const permissionOverwrites: any[] = [
          { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
        ];

        const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
        if (botMember) {
          permissionOverwrites.push({
            id: botMember.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
            ],
          });
        }

        if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
          permissionOverwrites.push({
            id: supportRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          });
        }

        targetChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: categoryId && guild.channels.cache.has(categoryId) ? categoryId : undefined,
          permissionOverwrites,
        });

        await db.query(
          `INSERT INTO guild_tickets (guild_id, channel_id, user_id, status, ticket_type, project_type, budget, timeline, pages, details)
           VALUES ($1, $2, $3, 'OPEN', 'WEBSITE_QUOTATION', $4, $5, $6, $7, $8)`,
          [guild.id, targetChannel.id, interaction.user.id, websiteType, targetBudget, targetTimeline, websitePages, projectDetails]
        ).catch(() => {});
      }

      const intakeEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🌐 Website Creation & Development — Quotation Request')
        .setDescription(
          `**Client:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
          `**Project Category:** \`${websiteType}\`\n\n` +
          `Thank you for submitting your project specifications! Our web development engineering team has received your details and will generate a personalized itemized quotation.`
        )
        .addFields(
          { name: '💻 Website Type', value: `\`${websiteType}\``, inline: true },
          { name: '📑 Pages & Scope', value: `\`${websitePages}\``, inline: true },
          { name: '💰 Target Budget', value: `\`${targetBudget}\``, inline: true },
          { name: '⏱️ Target Timeline', value: `\`${targetTimeline}\``, inline: true },
          { name: '📌 Quotation Status', value: `\`🟡 Awaiting Staff Proposal\``, inline: true },
          { name: '📝 Features, Scope & References', value: `\`\`\`${projectDetails.slice(0, 950)}\`\`\``, inline: false }
        )
        .setFooter({ text: 'SRB NEXUS Web Architecture Suite • Automated Quotation Pipeline' })
        .setTimestamp();

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`nexus_staff_create_quote_${interaction.user.id}`)
          .setLabel('Create Formal Quotation')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💼'),
        new ButtonBuilder()
          .setCustomId('nexus_close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await targetChannel.send({
        content: `🔔 <@${interaction.user.id}> | Staff notification`,
        embeds: [intakeEmbed],
        components: [actionRow],
      });

      await interaction.editReply({
        content: `✅ Your website creation quotation inquiry has been registered in ${targetChannel}!`,
      });

      broadcastLiveNotification(interaction.client, guild.id, {
        type: 'ticket',
        title: 'Website Quotation Requested',
        description: `New website creation quotation request by <@${interaction.user.id}> for **${websiteType}** in ${targetChannel}`,
        severity: 'info',
        fields: [
          { name: 'Type', value: websiteType, inline: true },
          { name: 'Budget', value: targetBudget, inline: true },
        ],
      }).catch(() => {});
    } catch (err) {
      logger.error({ err }, 'Failed to process website quotation modal');
      if (interaction.deferred) {
        await interaction.editReply({ content: 'Failed to create quotation channel. Please check bot permissions.' });
      }
    }
    return;
  }

  // 3c. HANDLE STAFF CLICK "CREATE FORMAL QUOTATION" BUTTON
  if (interaction.isButton() && interaction.customId.startsWith('nexus_staff_create_quote')) {
    const clientId = interaction.customId.replace('nexus_staff_create_quote_', '').replace('nexus_staff_create_quote', '') || interaction.user.id;

    const modal = new ModalBuilder()
      .setCustomId(`nexus_staff_quote_modal_${clientId}`)
      .setTitle('Formal Website Quotation Proposal');

    const titleInput = new TextInputBuilder()
      .setCustomId('quote_title')
      .setLabel('Project Package / Title')
      .setPlaceholder('e.g. Full-Stack Custom SaaS Web App / E-Commerce Store')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const costInput = new TextInputBuilder()
      .setCustomId('quote_cost')
      .setLabel('Total Cost & Currency')
      .setPlaceholder('e.g. $750 USD or ₹35,000 INR')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const timelineInput = new TextInputBuilder()
      .setCustomId('quote_timeline')
      .setLabel('Estimated Delivery Timeframe')
      .setPlaceholder('e.g. 14 Business Days or 3 Weeks')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const deliverablesInput = new TextInputBuilder()
      .setCustomId('quote_deliverables')
      .setLabel('Deliverables (Comma-separated or lines)')
      .setPlaceholder('e.g. Responsive UI, Fastify Backend, PostgreSQL, Stripe Checkout, Admin CMS')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const termsInput = new TextInputBuilder()
      .setCustomId('quote_terms')
      .setLabel('Commercial Terms & Next Steps')
      .setPlaceholder('e.g. 50% advance to start, 50% on final approval. 30 days warranty.')
      .setStyle(TextInputStyle.Paragraph)
      .setValue('50% advance deposit to commence development, 50% balance upon final staging approval. Includes 30 days post-launch technical support.')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(costInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timelineInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(deliverablesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(termsInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // 3d. HANDLE STAFF QUOTATION MODAL SUBMIT
  if (interaction.isModalSubmit() && interaction.customId.startsWith('nexus_staff_quote_modal')) {
    const clientId = interaction.customId.replace('nexus_staff_quote_modal_', '').replace('nexus_staff_quote_modal', '') || interaction.user.id;
    const title = interaction.fields.getTextInputValue('quote_title');
    const cost = interaction.fields.getTextInputValue('quote_cost');
    const timeline = interaction.fields.getTextInputValue('quote_timeline');
    const deliverables = interaction.fields.getTextInputValue('quote_deliverables');
    const terms = interaction.fields.getTextInputValue('quote_terms') || 'Standard terms apply.';

    const quoteId = `NX-Q${Date.now().toString().slice(-6)}`;

    // Update DB record
    await db.query(
      `UPDATE guild_tickets 
       SET quote_amount = $1, quote_status = 'PROPOSED', project_type = $2, timeline = $3
       WHERE channel_id = $4`,
      [cost, title, timeline, interaction.channelId]
    ).catch(() => {});

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🌐 Official Website Creation Proposal — ${quoteId}`)
      .setDescription(
        `**Prepared By:** <@${interaction.user.id}>\n` +
        `**Prepared For:** <@${clientId}>\n` +
        `**Project Package:** **${title}**\n\n` +
        `Here is your official website development proposal and delivery schedule.`
      )
      .addFields(
        {
          name: '💵 Total Investment',
          value: `\`\`\`css\n${cost}\n\`\`\``,
          inline: true,
        },
        {
          name: '⏱️ Estimated Delivery',
          value: `\`\`\`yaml\n${timeline}\n\`\`\``,
          inline: true,
        },
        {
          name: '📌 Status',
          value: `\`🟡 Awaiting Client Acceptance\``,
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
      content: `🔔 <@${clientId}>, your official website development quotation is ready for review!`,
      embeds: [embed],
      components: [actionRow],
    });
    return;
  }

  // 3e. HANDLE CLIENT ACCEPT QUOTATION
  if (interaction.isButton() && interaction.customId.startsWith('nexus_quote_accept_')) {
    const quoteId = interaction.customId.replace('nexus_quote_accept_', '');

    await db.query(
      `UPDATE guild_tickets SET quote_status = 'ACCEPTED' WHERE channel_id = $1`,
      [interaction.channelId]
    ).catch(() => {});

    const acceptEmbed = new EmbedBuilder()
      .setColor('#10B981')
      .setTitle(`🎉 Quotation Accepted — ${quoteId}`)
      .setDescription(
        `Thank you <@${interaction.user.id}>! You have officially accepted website development quotation **${quoteId}**.\n\n` +
        `Our engineering team has been notified to proceed with project kickoff, technical onboarding, and milestone scheduling.`
      )
      .addFields(
        { name: '📌 Project Status', value: '`🚀 IN PROGRESS / ONBOARDING`', inline: true },
        { name: '👤 Approved By', value: `<@${interaction.user.id}>`, inline: true }
      )
      .setFooter({ text: 'SRB NEXUS Web Development Solutions' })
      .setTimestamp();

    await interaction.reply({
      content: `@here 🎉 Quotation **${quoteId}** has been accepted by the client!`,
      embeds: [acceptEmbed],
    });
    return;
  }

  // 3f. HANDLE CLIENT REVISE QUOTATION
  if (interaction.isButton() && interaction.customId.startsWith('nexus_quote_revise_')) {
    const quoteId = interaction.customId.replace('nexus_quote_revise_', '');

    const modal = new ModalBuilder()
      .setCustomId(`nexus_quote_revision_modal_${quoteId}`)
      .setTitle(`Quotation Revision — ${quoteId}`);

    const notesInput = new TextInputBuilder()
      .setCustomId('revision_notes')
      .setLabel('Requested Adjustments / Feedback')
      .setPlaceholder('Describe any changes to budget, features, pages, or timeline...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput));
    await interaction.showModal(modal);
    return;
  }

  // 3g. HANDLE CLIENT REVISION MODAL SUBMISSION
  if (interaction.isModalSubmit() && interaction.customId.startsWith('nexus_quote_revision_modal')) {
    const quoteId = interaction.customId.replace('nexus_quote_revision_modal_', '');
    const notes = interaction.fields.getTextInputValue('revision_notes');

    await db.query(
      `UPDATE guild_tickets SET quote_status = 'REVISION_REQUESTED' WHERE channel_id = $1`,
      [interaction.channelId]
    ).catch(() => {});

    const revEmbed = new EmbedBuilder()
      .setColor('#F59E0B')
      .setTitle(`💬 Revision Requested for Quotation — ${quoteId}`)
      .setDescription(`Client <@${interaction.user.id}> has submitted requested adjustments for quotation **${quoteId}**:`)
      .addFields(
        { name: '📝 Requested Changes', value: `\`\`\`${notes.slice(0, 950)}\`\`\`` }
      )
      .setFooter({ text: 'Staff will review and update the proposal shortly.' })
      .setTimestamp();

    await interaction.reply({
      content: `@here 🔔 Client has requested a revision on quotation **${quoteId}**.`,
      embeds: [revEmbed],
    });
    return;
  }

  // 4. HANDLE CLOSE TICKET BUTTON
  if (interaction.isButton() && interaction.customId === 'nexus_close_ticket') {
    if (!interaction.guild || !interaction.channel) return;

    try {
      await interaction.reply({ content: '🔒 Ticket acknowledged. Closing and deleting channel in 5 seconds...' });

      // Update DB record
      await db.query(
        `UPDATE guild_tickets SET status = 'CLOSED', closed_at = NOW() WHERE channel_id = $1`,
        [interaction.channel.id]
      ).catch(() => {});

      broadcastLiveNotification(interaction.client, interaction.guild.id, {
        type: 'ticket',
        title: 'Support Ticket Closed',
        description: `Support ticket closed by <@${interaction.user.id}> (${interaction.user.username})`,
        severity: 'info',
      }).catch(() => {});

      setTimeout(async () => {
        await interaction.channel?.delete().catch(() => {});
      }, 5000);
    } catch (err) {
      logger.error({ err }, 'Error closing ticket');
    }
    return;
  }

  // 5. HANDLE REACTION ROLE BUTTONS
  if (interaction.isButton() && interaction.customId.startsWith('nexus_role_')) {
    if (!interaction.guild || !interaction.member) return;

    const roleId = interaction.customId.replace('nexus_role_', '');
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const role = interaction.guild.roles.cache.get(roleId);

    if (!member || !role) {
      await interaction.reply({
        content: '❌ Role not found on this server.',
        ephemeral: true,
      });
      return;
    }

    try {
      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role);
        await interaction.reply({
          content: `➖ Removed the **@${role.name}** role from your profile.`,
          ephemeral: true,
        });
        return;
      } else {
        await member.roles.add(role);
        await interaction.reply({
          content: `➕ Successfully added the **@${role.name}** role to your profile!`,
          ephemeral: true,
        });
        return;
      }
    } catch (err: any) {
      await interaction.reply({
        content: `❌ Could not modify role: Make sure my bot role is higher than **@${role.name}** in Server Settings.`,
        ephemeral: true,
      });
      return;
    }
  }

  // 6. HANDLE GIVEAWAY ENTRY BUTTON
  if (interaction.isButton() && interaction.customId === 'nexus_giveaway_enter') {
    if (!interaction.guild || !interaction.message) return;

    try {
      const res = await db.query(
        `SELECT * FROM giveaways WHERE guild_id = $1 AND message_id = $2`,
        [interaction.guild.id, interaction.message.id]
      );

      if (res.rows.length === 0) {
        await interaction.reply({
          content: '❌ Giveaway record not found.',
          ephemeral: true,
        });
        return;
      }

      const giveaway = res.rows[0];
      if (giveaway.ended || new Date(giveaway.ends_at) <= new Date()) {
        await interaction.reply({
          content: '❌ This giveaway has already ended!',
          ephemeral: true,
        });
        return;
      }

      let entries: string[] = giveaway.entries || [];
      const userId = interaction.user.id;
      const alreadyEntered = entries.includes(userId);

      if (alreadyEntered) {
        entries = entries.filter((id) => id !== userId);
        await db.query(`UPDATE giveaways SET entries = $1 WHERE id = $2`, [entries, giveaway.id]);

        // Update button counter
        const button = new ButtonBuilder()
          .setCustomId('nexus_giveaway_enter')
          .setLabel(`🎉 Enter Giveaway (${entries.length})`)
          .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        await interaction.message.edit({ components: [row] }).catch(() => {});

        await interaction.reply({
          content: '👋 You have withdrawn from the giveaway.',
          ephemeral: true,
        });
        return;
      } else {
        entries.push(userId);
        await db.query(`UPDATE giveaways SET entries = $1 WHERE id = $2`, [entries, giveaway.id]);

        // Update button counter
        const button = new ButtonBuilder()
          .setCustomId('nexus_giveaway_enter')
          .setLabel(`🎉 Enter Giveaway (${entries.length})`)
          .setStyle(ButtonStyle.Success);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        await interaction.message.edit({ components: [row] }).catch(() => {});

        await interaction.reply({
          content: '🎉 You have successfully entered the giveaway! Good luck!',
          ephemeral: true,
        });
        return;
      }
    } catch (err: any) {
      logger.error({ err }, 'Error handling giveaway entry');
      await interaction.reply({
        content: '❌ An error occurred while processing your entry.',
        ephemeral: true,
      });
      return;
    }
  }
}