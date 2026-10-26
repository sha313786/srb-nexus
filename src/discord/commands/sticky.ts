import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  NewsChannel,
} from 'discord.js';
import {
  setStickyMessage,
  removeStickyMessage,
  toggleStickyMessage,
  listGuildStickyMessages,
  getStickyConfig,
  buildStickyPayload,
} from '../../services/stickyService';

export const stickyCommand = {
  data: new SlashCommandBuilder()
    .setName('sticky')
    .setDescription('Pin persistent sticky messages to the bottom of channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Create or update a stickied message for a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to attach the sticky message to')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('The message text (supports markdown, links, emojis)')
            .setRequired(true)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('embed')
            .setDescription('Display the sticky message inside a formatted embed (default: false)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Optional title for the embed (only used if embed is true)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Optional hex color code for embed (e.g. #5865F2, #ef4444)')
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('cooldown')
            .setDescription('Minimum cooldown between reposts in seconds (default: 3s, min: 1, max: 30)')
            .setMinValue(1)
            .setMaxValue(30)
            .setRequired(false)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('threshold')
            .setDescription('Messages required before reposting sticky (default: 1, min: 1, max: 20)')
            .setMinValue(1)
            .setMaxValue(20)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove and delete the active sticky message from a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel with the sticky message to remove')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all configured sticky messages on this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('pause')
        .setDescription('Temporarily pause sticky message reposts in a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to pause')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('resume')
        .setDescription('Resume sticky message reposts in a paused channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to resume')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('preview')
        .setDescription('Preview the sticky message configured for a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to preview')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }
    } catch {
      if (!interaction.deferred && !interaction.replied) {
        return;
      }
    }

    if (!interaction.guild) {
      await interaction.editReply({ content: '❌ This command can only be used in servers.' });
      return;
    }

    // Permission check
    const member = interaction.member;
    const permissions = interaction.memberPermissions;
    if (
      !permissions?.has(PermissionFlagsBits.ManageMessages) &&
      !permissions?.has(PermissionFlagsBits.Administrator)
    ) {
      await interaction.editReply({
        content: '❌ You require the **Manage Messages** permission to configure sticky messages.',
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    // 1. SET SUBCOMMAND
    if (subcommand === 'set') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel | NewsChannel;
      const content = interaction.options.getString('message', true);
      const embed = interaction.options.getBoolean('embed') ?? false;
      const title = interaction.options.getString('title') ?? null;
      const color = interaction.options.getString('color') ?? '#5865F2';
      const cooldown = interaction.options.getInteger('cooldown') ?? 3;
      const threshold = interaction.options.getInteger('threshold') ?? 1;

      // Check bot permissions in target channel
      const botMember = interaction.guild.members.me;
      if (botMember) {
        const channelPerms = channel.permissionsFor(botMember);
        if (!channelPerms.has(PermissionFlagsBits.ViewChannel) || !channelPerms.has(PermissionFlagsBits.SendMessages)) {
          await interaction.editReply({
            content: `❌ I do not have permission to view or send messages in ${channel}. Please adjust channel permissions.`,
          });
          return;
        }
      }

      const result = await setStickyMessage({
        guildId: interaction.guild.id,
        channelId: channel.id,
        content,
        embed,
        embedTitle: title,
        embedColor: color,
        cooldownSeconds: cooldown,
        messageCountThreshold: threshold,
        channel,
      });

      if (!result.success) {
        await interaction.editReply({ content: result.message });
        return;
      }

      const replyEmbed = new EmbedBuilder()
        .setTitle('📌 Sticky Message Configured')
        .setColor(0x10b981)
        .setDescription(result.message)
        .addFields(
          { name: 'Channel', value: `${channel}`, inline: true },
          { name: 'Mode', value: embed ? 'Embed' : 'Plain Text', inline: true },
          { name: 'Cooldown', value: `${cooldown}s`, inline: true },
          { name: 'Threshold', value: `${threshold} message(s)`, inline: true },
          {
            name: 'Sticky Preview',
            value: content.length > 250 ? content.slice(0, 247) + '...' : content,
            inline: false,
          }
        )
        .setFooter({ text: 'The sticky message will automatically reposition after new chat messages.' })
        .setTimestamp();

      const botPerms = botMember ? channel.permissionsFor(botMember) : null;
      if (botPerms && !botPerms.has(PermissionFlagsBits.ManageMessages)) {
        replyEmbed.addFields({
          name: '⚠️ Permission Notice',
          value: 'I lack `Manage Messages` in that channel, so previous sticky messages cannot be deleted automatically. Granting `Manage Messages` is recommended.',
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [replyEmbed] });
      return;
    }

    // 2. REMOVE SUBCOMMAND
    if (subcommand === 'remove') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const result = await removeStickyMessage(channel.id, interaction.guild.id, channel);
      await interaction.editReply({ content: result.message });
      return;
    }

    // 3. LIST SUBCOMMAND
    if (subcommand === 'list') {
      const stickies = await listGuildStickyMessages(interaction.guild.id);
      if (stickies.length === 0) {
        await interaction.editReply({
          content: 'ℹ️ No sticky messages are currently configured on this server. Use `/sticky set` to create one!',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📌 Server Sticky Messages (${stickies.length})`)
        .setColor(0x5865f2)
        .setDescription('Below are all active sticky messages configured across channels:')
        .setFooter({ text: 'Use /sticky remove or /sticky pause to manage' })
        .setTimestamp();

      for (const s of stickies) {
        const preview = s.content.length > 120 ? s.content.slice(0, 117) + '...' : s.content;
        const statusEmoji = s.is_active ? '🟢 Active' : '⏸️ Paused';
        embed.addFields({
          name: `#${interaction.guild.channels.cache.get(s.channel_id)?.name || s.channel_id} (${statusEmoji})`,
          value: `**Channel:** <#${s.channel_id}>\n**Mode:** ${s.embed ? 'Embed' : 'Text'} | **Cooldown:** ${s.cooldown_seconds}s | **Threshold:** ${s.message_count_threshold}\n**Content:** ${preview}`,
          inline: false,
        });
      }

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 4. PAUSE SUBCOMMAND
    if (subcommand === 'pause') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const result = await toggleStickyMessage(channel.id, interaction.guild.id, false, channel);
      await interaction.editReply({ content: result.message });
      return;
    }

    // 5. RESUME SUBCOMMAND
    if (subcommand === 'resume') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const result = await toggleStickyMessage(channel.id, interaction.guild.id, true, channel);
      await interaction.editReply({ content: result.message });
      return;
    }

    // 6. PREVIEW SUBCOMMAND
    if (subcommand === 'preview') {
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const config = getStickyConfig(channel.id);

      if (!config) {
        await interaction.editReply({
          content: `❌ No sticky message configured for ${channel}.`,
        });
        return;
      }

      const payload = buildStickyPayload(config);
      await interaction.editReply({
        content: `**Preview of sticky message for ${channel}:**\n\n${payload.content}`,
        embeds: payload.embeds || [],
      });
      return;
    }
  },
};
