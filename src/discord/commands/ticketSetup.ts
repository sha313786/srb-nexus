// Path: src/discord/commands/ticketSetup.ts
import { 
  ChatInputCommandInteraction, 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  Role,
} from 'discord.js';
import { db } from '../../core/database';

export const ticketSetupCommand = {
  data: new SlashCommandBuilder()
    .setName('nexus-ticket-setup')
    .setDescription('Configure and deploy the ticket support panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to send the ticket panel to (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('category')
        .setDescription('Category where new ticket channels will be placed')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addRoleOption((opt) =>
      opt
        .setName('support-role')
        .setDescription('Staff role that can view and respond to tickets')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('transcript-channel')
        .setDescription('Channel where ticket transcripts are saved upon closing')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const targetChannel = (interaction.options.getChannel('channel') as TextChannel) || (interaction.channel as TextChannel);
    const category = interaction.options.getChannel('category');
    const supportRole = interaction.options.getRole('support-role') as Role | null;
    const transcriptChannel = interaction.options.getChannel('transcript-channel') as TextChannel | null;

    if (!targetChannel || !('send' in targetChannel)) {
      await interaction.editReply({ content: '❌ Invalid target channel selected.' });
      return;
    }

    // Save configuration to database if options provided
    if (category || supportRole || transcriptChannel) {
      await db.query(
        `INSERT INTO guild_settings (guild_id, category_id, support_role_id, transcript_channel_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) DO UPDATE SET
           category_id = COALESCE($2, guild_settings.category_id),
           support_role_id = COALESCE($3, guild_settings.support_role_id),
           transcript_channel_id = COALESCE($4, guild_settings.transcript_channel_id),
           updated_at = CURRENT_TIMESTAMP`,
        [guild.id, category?.id || null, supportRole?.id || null, transcriptChannel?.id || null]
      ).catch(() => {});
    }

    const isStudio = guild.id === '1525065834572021851';

    const embed = new EmbedBuilder()
      .setTitle(isStudio ? 'support tickets' : '🎫 Support Tickets')
      .setDescription(
        isStudio
          ? 'need help or want to report an issue? select a category from the dropdown menu below to open a private support ticket.'
          : 'Need help or want to report an issue? Select a category from the dropdown menu below to open a private support ticket.'
      )
      .setColor(isStudio ? '#e74c3c' : '#5865F2')
      .setFooter({ 
        text: `© ${guild.name || 'SRB NEXUS'}`, 
        iconURL: guild.iconURL() || undefined 
      })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('nexus_ticket_select')
      .setPlaceholder('Select a ticket category...');

    if (isStudio) {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Website Creation Quotation')
          .setDescription('Request a custom website development quotation')
          .setValue('website-quote')
          .setEmoji('🌐'),
        new StringSelectMenuOptionBuilder()
          .setLabel('General Support')
          .setDescription('Get general help')
          .setValue('general')
          .setEmoji('❓'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Billing & Invoicing')
          .setDescription('Payment and milestone inquiries')
          .setValue('billing')
          .setEmoji('💳'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Bug Report / Revision')
          .setDescription('Report technical issues or site tweaks')
          .setValue('bug')
          .setEmoji('🐛')
      );
    } else {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('General Support')
          .setDescription('Get help with general questions')
          .setValue('general')
          .setEmoji('📩'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Question / Help')
          .setDescription('Ask questions or request assistance')
          .setValue('help')
          .setEmoji('❓'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Bug Report')
          .setDescription('Report a bug or technical issue')
          .setValue('bug')
          .setEmoji('🐛'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Member Report')
          .setDescription('Report a rule violation or user issue')
          .setValue('report')
          .setEmoji('🚨')
      );
    }

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await targetChannel.send({
      embeds: [embed],
      components: [row]
    });

    const configDetails: string[] = [];
    if (category) configDetails.push(`• **Ticket Category:** <#${category.id}>`);
    if (supportRole) configDetails.push(`• **Support Role:** <@&${supportRole.id}>`);
    if (transcriptChannel) configDetails.push(`• **Transcripts Channel:** <#${transcriptChannel.id}>`);

    await interaction.editReply({
      content: `✅ Ticket panel posted successfully in <#${targetChannel.id}>!${
        configDetails.length > 0 ? `\n\n**Updated Settings:**\n${configDetails.join('\n')}` : ''
      }`,
    });
  }
};
