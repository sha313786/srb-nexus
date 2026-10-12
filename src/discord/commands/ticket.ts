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
} from 'discord.js';
import { db } from '../../core/database';
import { broadcastLiveNotification } from '../../services/liveNotifications';

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket')
    .setDescription('Manage support and website quotation tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((sub) =>
      sub
        .setName('quote-form')
        .setDescription('Post the Website Creation Quotation questionnaire in this ticket')
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

    if (subcommand === 'close') {
      await interaction.reply({ content: '🔒 Ticket acknowledged. Closing and archiving channel in 5 seconds...' });

      await db.query(
        `UPDATE guild_tickets SET status = 'CLOSED', closed_at = NOW() WHERE channel_id = $1`,
        [channel.id]
      ).catch(() => {});

      broadcastLiveNotification(interaction.client, guild.id, {
        type: 'ticket',
        title: 'Support Ticket Closed',
        description: `Support ticket closed by <@${interaction.user.id}> (${interaction.user.username})`,
        severity: 'info',
      }).catch(() => {});

      setTimeout(async () => {
        await channel.delete().catch(() => {});
      }, 5000);
      return;
    }

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

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user', true);
      await channel.permissionOverwrites.delete(targetUser.id);

      await interaction.reply({
        content: `🚫 Successfully removed <@${targetUser.id}> from this ticket channel.`,
      });
      return;
    }

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