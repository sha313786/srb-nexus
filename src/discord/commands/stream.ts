import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { db } from '../../core/database';
import { fetchStreamInfo, testStreamNotification, StreamTrackerRow } from '../../services/streamNotifications';

export const streamCommand = {
  data: new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Multi-platform stream radar: Monitor Twitch, Kick, and YouTube live notifications')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Track a streamer and send live alerts when they go online')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Streaming platform')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch (🟣)', value: 'twitch' },
              { name: 'Kick (🟢)', value: 'kick' },
              { name: 'YouTube (🔴)', value: 'youtube' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('streamer').setDescription('Streamer username, handle, or channel slug').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Discord text channel for live alerts')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('mention')
            .setDescription('Notification mention')
            .setRequired(false)
            .addChoices(
              { name: 'None', value: 'none' },
              { name: '@everyone', value: 'everyone' },
              { name: '@here', value: 'here' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('message')
            .setDescription('Custom live message (Variables: {streamer}, {platform}, {game}, {url})')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Alert types to receive (default: Live Streams Only)')
            .setRequired(false)
            .addChoices(
              { name: 'Live Streams Only (Default)', value: 'live' },
              { name: 'Both (Live Streams & Videos)', value: 'all' },
              { name: 'Videos Only', value: 'upload' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Stop monitoring a streamer')
        .addStringOption((opt) =>
          opt.setName('streamer').setDescription('Streamer username to stop tracking').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all monitored streamers and their current live status')
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check real-time live status for any streamer right now')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Streaming platform')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'Kick', value: 'kick' },
              { name: 'YouTube', value: 'youtube' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('streamer').setDescription('Streamer username or handle').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Dispatch a simulated live stream alert to verify channel layout')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Streaming platform')
            .setRequired(true)
            .addChoices(
              { name: 'Twitch', value: 'twitch' },
              { name: 'Kick', value: 'kick' },
              { name: 'YouTube', value: 'youtube' }
            )
        )
        .addStringOption((opt) =>
          opt.setName('streamer').setDescription('Streamer name for the test alert').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target Discord channel')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    // 1. ADD STREAM TRACKER
    if (subcommand === 'add') {
      const platform = interaction.options.getString('platform', true) as 'twitch' | 'youtube' | 'kick';
      const rawStreamer = interaction.options.getString('streamer', true);
      const channel = interaction.options.getChannel('channel', true) as TextChannel;
      const mention = interaction.options.getString('mention') || 'none';
      const message = interaction.options.getString('message') || '{streamer} is now LIVE on {platform}! 🔴';
      const eventType = interaction.options.getString('type') || 'live';

      const cleanStreamer = rawStreamer
        .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com|youtube\.com)\//i, '')
        .replace(/[\/@]/g, '')
        .trim()
        .toLowerCase();

      // Check if already tracking
      const checkRes = await db.query(
        `SELECT id FROM stream_trackers WHERE guild_id = $1 AND platform = $2 AND channel_name = $3`,
        [interaction.guild.id, platform, cleanStreamer]
      );

      if (checkRes.rows.length > 0) {
        return interaction.reply({
          content: `⚠️ **${cleanStreamer}** (${platform.toUpperCase()}) is already being tracked on this server.`,
          ephemeral: true,
        });
      }

      await db.query(
        `INSERT INTO stream_trackers (guild_id, platform, channel_name, display_name, discord_channel_id, custom_message, mention_role, event_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [interaction.guild.id, platform, cleanStreamer, rawStreamer, channel.id, message, mention, eventType]
      );

      const embed = new EmbedBuilder()
        .setColor('#10B981')
        .setTitle('✅ Stream Radar Active')
        .setDescription(`Successfully added **${cleanStreamer}** to the Multi-Platform Stream Radar!`)
        .addFields(
          { name: '🌐 Platform', value: platform.toUpperCase(), inline: true },
          { name: '📢 Notification Channel', value: `<#${channel.id}>`, inline: true },
          { name: '🔔 Mention', value: mention === 'none' ? 'None' : `@${mention}`, inline: true },
          { name: '🔔 Alert Mode', value: eventType === 'live' ? '🔴 Live Streams Only' : (eventType === 'upload' ? '🎬 Videos Only' : '🔴 Live & 🎬 Videos'), inline: true },
          { name: '💬 Custom Message', value: `\`${message}\`` }
        )
        .setFooter({ text: 'SRB NEXUS Stream Radar' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // 2. REMOVE STREAM TRACKER
    if (subcommand === 'remove') {
      const streamer = interaction.options.getString('streamer', true).trim().toLowerCase();

      const delRes = await db.query(
        `DELETE FROM stream_trackers 
         WHERE guild_id = $1 AND (LOWER(channel_name) = $2 OR LOWER(display_name) = $2)
         RETURNING platform, channel_name`,
        [interaction.guild.id, streamer]
      );

      if (delRes.rows.length === 0) {
        return interaction.reply({
          content: `❌ Could not find a tracked streamer matching \`${streamer}\` on this server.`,
          ephemeral: true,
        });
      }

      return interaction.reply({
        content: `🗑️ Successfully stopped monitoring **${delRes.rows[0].channel_name}** (${delRes.rows[0].platform.toUpperCase()}).`,
      });
    }

    // 3. LIST STREAM TRACKERS
    if (subcommand === 'list') {
      const res = await db.query<StreamTrackerRow>(
        `SELECT * FROM stream_trackers WHERE guild_id = $1 ORDER BY platform, channel_name`,
        [interaction.guild.id]
      );

      if (res.rows.length === 0) {
        return interaction.reply({
          content: `📡 No streamers currently tracked. Use \`/stream add\` or the Web Dashboard to add streamers!`,
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor('#6366F1')
        .setTitle(`📡 Tracked Streamers (${res.rows.length})`)
        .setDescription('Real-time multi-platform live stream alerts are active for these creators:')
        .setFooter({ text: 'SRB NEXUS Stream Radar' })
        .setTimestamp();

      for (const t of res.rows) {
        let pIcon = '🟣';
        if (t.platform === 'kick') pIcon = '🟢';
        if (t.platform === 'youtube') pIcon = '🔴';

        const liveTag = t.is_live ? '`🔴 LIVE NOW`' : '`⚫ Offline`';

        const modeLabel = t.event_type === 'live' ? '🔴 Live Only' : (t.event_type === 'upload' ? '🎬 Videos Only' : '🔴 Live & 🎬 Videos');
        embed.addFields({
          name: `${pIcon} ${t.display_name || t.channel_name} (${t.platform.toUpperCase()})`,
          value: `Status: ${liveTag}\nMode: \`${modeLabel}\`\nChannel: <#${t.discord_channel_id}>\nMention: \`${t.mention_role || 'none'}\``,
          inline: true,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }

    // 4. CHECK REAL-TIME STREAM STATUS
    if (subcommand === 'check') {
      await interaction.deferReply();
      const platform = interaction.options.getString('platform', true) as 'twitch' | 'youtube' | 'kick';
      const streamer = interaction.options.getString('streamer', true);

      const info = await fetchStreamInfo(platform, streamer);

      let color: `#${string}` = '#64748B';
      if (info.isLive) {
        color = platform === 'kick' ? '#53FC18' : (platform === 'youtube' ? '#FF0000' : '#9146FF');
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${info.isLive ? '🔴 LIVE NOW' : '⚫ OFFLINE'}: ${info.displayName}`)
        .setURL(info.streamUrl)
        .addFields(
          { name: '🌐 Platform', value: platform.toUpperCase(), inline: true },
          { name: '🎮 Category', value: info.game || 'N/A', inline: true },
          { name: '👥 Viewers', value: info.isLive ? `${info.viewers?.toLocaleString() || 'Live'}` : '0', inline: true },
          { name: '📺 Title', value: info.title || 'N/A' }
        )
        .setFooter({ text: 'SRB NEXUS Real-Time Radar Check' })
        .setTimestamp();

      if (info.avatarUrl) embed.setThumbnail(info.avatarUrl);
      if (info.thumbnailUrl && info.isLive) embed.setImage(info.thumbnailUrl);

      return interaction.editReply({ embeds: [embed] });
    }

    // 5. TEST ALERT BROADCAST
    if (subcommand === 'test') {
      await interaction.deferReply();
      const platform = interaction.options.getString('platform', true) as 'twitch' | 'youtube' | 'kick';
      const streamer = interaction.options.getString('streamer', true);
      const channel = interaction.options.getChannel('channel', true) as TextChannel;

      try {
        await testStreamNotification(interaction.client, interaction.guild.id, {
          platform,
          channel_name: streamer,
          display_name: streamer,
          discord_channel_id: channel.id,
          mention_role: 'none',
        });

        return interaction.editReply({
          content: `✅ Test live stream alert for **${streamer}** (${platform.toUpperCase()}) dispatched to <#${channel.id}>!`,
        });
      } catch (err: any) {
        return interaction.editReply({
          content: `❌ Failed to dispatch test alert: ${err.message}`,
        });
      }
    }
  },
};
