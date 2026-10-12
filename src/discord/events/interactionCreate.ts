import {
  Interaction,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

  // 3. HANDLE TICKET CREATION BUTTON (Supports both nexus_ticket_create and nexus_create_ticket)
  if (interaction.isButton() && (interaction.customId === 'nexus_ticket_create' || interaction.customId === 'nexus_create_ticket')) {
    const guild = interaction.guild;
    if (!guild) return;

    try {
      await interaction.deferReply({ ephemeral: true });

      const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 16) || 'member';
      const userTag = interaction.user.discriminator && interaction.user.discriminator !== '0'
        ? interaction.user.discriminator
        : interaction.user.id.slice(-4);
      const channelName = `ticket-${cleanName}-${userTag}`;

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
        .setTitle(`🎫 Support Ticket — #${channelName}`)
        .setDescription(`Hello <@${interaction.user.id}>! Thank you for reaching out. Please state your issue below.\n\nA staff member will assist you shortly. Click **Close Ticket** when resolved.`)
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
        title: 'Support Ticket Opened',
        description: `New support ticket opened by <@${interaction.user.id}> (${interaction.user.username}) in ${ticketChannel}`,
        severity: 'info',
        fields: [
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