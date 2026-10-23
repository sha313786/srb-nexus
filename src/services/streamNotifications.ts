import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';
import { recordLiveEvent } from './liveNotifications';

export interface StreamInfo {
  isLive: boolean;
  platform: 'twitch' | 'youtube' | 'kick';
  eventType?: 'live' | 'upload' | 'premiere';
  channelName: string;
  displayName: string;
  title: string;
  game: string;
  viewers?: number;
  avatarUrl?: string;
  thumbnailUrl?: string;
  streamUrl: string;
  streamId?: string;
}

export interface StreamTrackerRow {
  id: number;
  guild_id: string;
  platform: 'twitch' | 'youtube' | 'kick';
  channel_name: string;
  display_name: string | null;
  discord_channel_id: string;
  custom_message: string | null;
  mention_role: string | null;
  event_type?: string | null;
  is_live: boolean;
  last_stream_id: string | null;
  last_title: string | null;
  last_game: string | null;
  last_checked_at: Date;
  created_at: Date;
}

const KNOWN_CHANNEL_IDS: Record<string, string> = {
  'jackalknightyt': 'UCIi1sRUljdH7wTdW8X_pp9g',
  'srbtrollersyt': 'UCdKhGijZa4-K5QEQjxAX6yg',
};

/**
 * Fetch live status and stream metadata across Twitch, Kick, and YouTube
 */
export async function fetchStreamInfo(
  platform: 'twitch' | 'youtube' | 'kick',
  rawChannel: string
): Promise<StreamInfo> {
  const cleanName = rawChannel
    .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com|youtube\.com)\//i, '')
    .replace(/[\/@]/g, '')
    .trim()
    .toLowerCase();

  // 1. TWITCH STREAM CHECK
  if (platform === 'twitch') {
    try {
      const uptimeRes = await fetch(`https://decapi.me/twitch/uptime/${cleanName}`, {
        headers: { 'User-Agent': 'SRB-NEXUS-Bot/1.0' }
      });
      const uptimeText = (await uptimeRes.text()).trim();

      const isOffline = uptimeText.toLowerCase().includes('offline') ||
                        uptimeText.toLowerCase().includes('not found') ||
                        uptimeText.length === 0;

      const avatarRes = await fetch(`https://decapi.me/twitch/avatar/${cleanName}`).catch(() => null);
      const avatarUrl = avatarRes?.ok ? (await avatarRes.text()).trim() : undefined;

      const titleRes = await fetch(`https://decapi.me/twitch/title/${cleanName}`).catch(() => null);
      const title = titleRes?.ok ? (await titleRes.text()).trim() : 'Live Stream';

      const gameRes = await fetch(`https://decapi.me/twitch/game/${cleanName}`).catch(() => null);
      const game = gameRes?.ok ? (await gameRes.text()).trim() : 'Just Chatting';

      const viewersRes = await fetch(`https://decapi.me/twitch/viewercount/${cleanName}`).catch(() => null);
      const viewersStr = viewersRes?.ok ? (await viewersRes.text()).trim() : '0';
      const viewers = parseInt(viewersStr, 10) || 0;

      return {
        isLive: !isOffline,
        platform: 'twitch',
        channelName: cleanName,
        displayName: cleanName,
        title: title || 'Live on Twitch',
        game: game || 'Just Chatting',
        viewers: isOffline ? 0 : viewers,
        avatarUrl: avatarUrl?.startsWith('http') ? avatarUrl : undefined,
        thumbnailUrl: !isOffline ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${cleanName}-1280x720.jpg?t=${Date.now()}` : undefined,
        streamUrl: `https://twitch.tv/${cleanName}`,
        streamId: isOffline ? undefined : `${cleanName}_${Date.now()}`
      };
    } catch (err) {
      logger.error({ err, cleanName }, 'Failed to fetch Twitch stream status');
      return {
        isLive: false,
        platform: 'twitch',
        channelName: cleanName,
        displayName: cleanName,
        title: 'Offline',
        game: 'Offline',
        streamUrl: `https://twitch.tv/${cleanName}`,
      };
    }
  }

  // 2. KICK STREAM CHECK
  if (platform === 'kick') {
    try {
      const res = await fetch(`https://kick.com/api/v1/channels/${cleanName}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const data: any = await res.json();
        const livestream = data.livestream;
        const isLive = Boolean(livestream && livestream.is_live !== false);

        return {
          isLive,
          platform: 'kick',
          channelName: cleanName,
          displayName: data.user?.username || cleanName,
          title: livestream?.session_title || data.previous_livestreams?.[0]?.session_title || 'Live on Kick',
          game: livestream?.categories?.[0]?.name || 'Just Chatting',
          viewers: livestream?.viewer_count || 0,
          avatarUrl: data.user?.profile_pic || undefined,
          thumbnailUrl: livestream?.thumbnail?.url || undefined,
          streamUrl: `https://kick.com/${cleanName}`,
          streamId: livestream?.id ? String(livestream.id) : undefined
        };
      }
    } catch (err) {
      logger.error({ err, cleanName }, 'Failed to fetch Kick stream status');
    }

    return {
      isLive: false,
      platform: 'kick',
      channelName: cleanName,
      displayName: cleanName,
      title: 'Offline',
      game: 'Offline',
      streamUrl: `https://kick.com/${cleanName}`,
    };
  }

  // 3. YOUTUBE STREAM & VIDEO CHECK
  if (platform === 'youtube') {
    try {
      const handle = rawChannel.startsWith('@') ? rawChannel : `@${cleanName}`;

      let isLive = false;
      let liveTitle = '';
      let liveVideoId = '';
      let liveViewerCount = 0;
      let liveThumbnail = '';
      let channelId = '';
      let authorName = '';

      // Check known channel dictionary or direct UC channel ID
      if (cleanName in KNOWN_CHANNEL_IDS) {
        channelId = KNOWN_CHANNEL_IDS[cleanName];
      } else if (rawChannel.match(/^(UC[a-zA-Z0-9_-]{22})$/)) {
        channelId = rawChannel;
      }

      // Step 1: Query YouTube InnerTube resolve_url API for active live stream
      try {
        const resolveTarget = `https://www.youtube.com/@${cleanName}/live`;
        const resolveRes = await fetch('https://www.youtube.com/youtubei/v1/navigation/resolve_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: resolveTarget,
            context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (resolveRes.ok) {
          const resolveData: any = await resolveRes.json();
          const endpoint = resolveData.endpoint;
          const candidateVideoId = endpoint?.watchEndpoint?.videoId;
          const pageType = endpoint?.commandMetadata?.webCommandMetadata?.webPageType;

          if (endpoint?.browseEndpoint?.browseId && !channelId) {
            channelId = endpoint.browseEndpoint.browseId;
          }

          // If /live resolved to a watch page with a video ID, the creator is actively LIVE NOW!
          if (candidateVideoId && pageType === 'WEB_PAGE_TYPE_WATCH') {
            isLive = true;
            liveVideoId = candidateVideoId;
            liveTitle = 'Live on YouTube';
            liveThumbnail = `https://i.ytimg.com/vi/${candidateVideoId}/maxresdefault.jpg`;

            // Enrich metadata via official YouTube oEmbed API
            try {
              const oeRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${candidateVideoId}&format=json`, {
                signal: AbortSignal.timeout(5000)
              });
              if (oeRes.ok) {
                const oeData: any = await oeRes.json();
                if (oeData.title) liveTitle = oeData.title;
                if (oeData.author_name) authorName = oeData.author_name;
                if (oeData.thumbnail_url) liveThumbnail = oeData.thumbnail_url;
              }
            } catch (oeErr) {
              logger.warn({ oeErr, candidateVideoId }, '[RADAR] Failed to fetch oEmbed details');
            }
          }
        }
      } catch (err) {
        logger.warn({ err, handle }, '[RADAR] Failed during YouTube InnerTube live resolve');
      }

      // Step 2: Fallback / Secondary RSS Check for recent video upload
      let latestVideoId = '';
      let latestVideoTitle = '';
      let latestVideoUrl = `https://youtube.com/${handle}`;
      let latestThumbnail = '';

      if (!isLive && channelId) {
        try {
          const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(6000)
          });
          if (rssRes.ok) {
            const xml = await rssRes.text();
            const idMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = xml.match(/<media:title>(.*?)<\/media:title>/) || xml.match(/<title>(.*?)<\/title>/);
            const authorTag = xml.match(/<author>\s*<name>(.*?)<\/name>/);
            if (authorTag && authorTag[1]) authorName = authorTag[1];

            if (idMatch && idMatch[1]) {
              latestVideoId = idMatch[1];
              latestVideoTitle = titleMatch ? titleMatch[1].trim() : 'New YouTube Video';
              latestVideoUrl = `https://www.youtube.com/watch?v=${latestVideoId}`;
              latestThumbnail = `https://i.ytimg.com/vi/${latestVideoId}/hqdefault.jpg`;
            }
          }
        } catch (err) {
          logger.warn({ err, channelId }, '[RADAR] Failed during YouTube RSS check');
        }
      }

      // If genuinely live right now, return active Live Stream
      if (isLive && liveVideoId) {
        return {
          isLive: true,
          eventType: 'live',
          platform: 'youtube',
          channelName: cleanName,
          displayName: authorName || handle,
          title: liveTitle || 'Live on YouTube',
          game: 'YouTube Live',
          viewers: liveViewerCount || 1,
          thumbnailUrl: liveThumbnail || `https://i.ytimg.com/vi/${liveVideoId}/hqdefault.jpg`,
          streamUrl: `https://www.youtube.com/watch?v=${liveVideoId}`,
          streamId: liveVideoId
        };
      }

      // If not live, but recent video was found
      if (latestVideoId) {
        return {
          isLive: false,
          eventType: 'upload',
          platform: 'youtube',
          channelName: cleanName,
          displayName: authorName || handle,
          title: latestVideoTitle || 'New YouTube Video',
          game: 'Video Upload',
          viewers: 0,
          thumbnailUrl: latestThumbnail,
          streamUrl: latestVideoUrl,
          streamId: latestVideoId
        };
      }

      return {
        isLive: false,
        eventType: 'live',
        platform: 'youtube',
        channelName: cleanName,
        displayName: authorName || handle,
        title: 'Offline',
        game: 'YouTube',
        streamUrl: `https://youtube.com/${handle}`,
      };
    } catch (err) {
      logger.error({ err, cleanName }, 'Failed to check YouTube status');
      return {
        isLive: false,
        eventType: 'live',
        platform: 'youtube',
        channelName: cleanName,
        displayName: cleanName,
        title: 'Offline',
        game: 'YouTube',
        streamUrl: `https://youtube.com/@${cleanName}`,
      };
    }
  }

  throw new Error(`Unsupported streaming platform: ${platform}`);
}

/**
 * Build rich Discord embed for live stream or video upload notification
 */
export function buildStreamEmbed(tracker: Partial<StreamTrackerRow>, info: StreamInfo): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
  content?: string;
} {
  const isVideoUpload = info.eventType === 'upload';
  const isPremiere = info.eventType === 'premiere';

  let color: `#${string}` = '#9146FF';
  let badge = '🟣 TWITCH';
  let btnLabel = 'Watch on Twitch';

  if (info.platform === 'kick') {
    color = '#53FC18';
    badge = '🟢 KICK';
    btnLabel = 'Watch on Kick';
  } else if (info.platform === 'youtube') {
    color = '#FF0000';
    badge = '🔴 YOUTUBE';
    btnLabel = isVideoUpload ? 'Watch New Video' : (isPremiere ? 'Watch Premiere' : 'Watch on YouTube');
  }

  const alertTypeLabel = isVideoUpload
    ? 'NEW VIDEO UPLOAD'
    : (isPremiere ? 'VIDEO PREMIERE' : 'LIVE STREAM ALERT');

  const titleHeader = isVideoUpload
    ? `🎬 ${info.displayName || info.channelName} uploaded a new video!`
    : (isPremiere
        ? `⭐ ${info.displayName || info.channelName} is premiering a video!`
        : `🔴 ${info.displayName || info.channelName} is now LIVE!`);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: `${badge} • ${alertTypeLabel}`,
      iconURL: info.avatarUrl || undefined,
      url: info.streamUrl
    })
    .setTitle(titleHeader)
    .setURL(info.streamUrl)
    .setDescription(`**${info.title || (isVideoUpload ? 'New Video' : 'Untitled Stream')}**`)
    .addFields(
      {
        name: isVideoUpload ? '📂 Content Type' : '🎮 Category / Game',
        value: `\`${isVideoUpload ? 'Video Upload' : (info.game || 'Just Chatting')}\``,
        inline: true
      },
      {
        name: isVideoUpload ? '🕒 Status' : '👥 Viewers',
        value: isVideoUpload ? '`Uploaded & Ready`' : `\`${info.viewers ? info.viewers.toLocaleString() : 'Live'}\``,
        inline: true
      },
      { name: '🌐 Platform', value: `**${info.platform.toUpperCase()}**`, inline: true }
    )
    .setFooter({ text: 'SRB NEXUS Stream Radar' })
    .setTimestamp();

  if (info.thumbnailUrl) {
    embed.setImage(info.thumbnailUrl);
  }
  if (info.avatarUrl) {
    embed.setThumbnail(info.avatarUrl);
  }

  const watchBtn = new ButtonBuilder()
    .setLabel(btnLabel)
    .setStyle(ButtonStyle.Link)
    .setURL(info.streamUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchBtn);

  // Formulate mention text
  let mention = '';
  if (tracker.mention_role === 'everyone') {
    mention = '@everyone ';
  } else if (tracker.mention_role === 'here') {
    mention = '@here ';
  } else if (tracker.mention_role && tracker.mention_role !== 'none') {
    mention = `<@&${tracker.mention_role}> `;
  }

  const typeDisplay = isVideoUpload ? 'new video' : (isPremiere ? 'premiere' : 'live stream');

  let defaultTemplate = isVideoUpload
    ? '{streamer} just uploaded a new video on {platform}! 🎬'
    : (isPremiere
        ? '{streamer} is premiering a new video on {platform}! ⭐'
        : '{streamer} is now LIVE on {platform}! 🔴');

  let customText = tracker.custom_message || defaultTemplate;

  // Auto-adapt if user had "{streamer} is now LIVE on {platform}! 🔴" but this event is a video upload
  if (isVideoUpload && customText.includes('is now LIVE')) {
    customText = customText.replace(/is now LIVE/gi, 'just uploaded a new video').replace(/🔴/g, '🎬');
  }

  customText = customText
    .replace(/{streamer}/g, `**${info.displayName || info.channelName}**`)
    .replace(/{platform}/g, info.platform.toUpperCase())
    .replace(/{title}/g, info.title || 'New Release')
    .replace(/{game}/g, info.game || 'Streaming')
    .replace(/{type}/g, typeDisplay)
    .replace(/{url}/g, info.streamUrl);

  const content = `${mention}${customText}`;

  return { embed, row, content };
}

/**
 * Dispatch live stream or video upload alert to Discord channel and dashboard live stream
 */
export async function dispatchStreamNotification(
  bot: Client,
  tracker: StreamTrackerRow,
  info: StreamInfo
): Promise<boolean> {
  try {
    const channel = (await bot.channels.fetch(tracker.discord_channel_id).catch(() => null)) as TextChannel;
    if (!channel || !channel.isTextBased()) return false;

    const { embed, row, content } = buildStreamEmbed(tracker, info);

    await channel.send({
      content,
      embeds: [embed],
      components: [row],
      allowedMentions: {
        parse: ['everyone', 'roles', 'users']
      }
    });

    // Record in Dashboard Live Feed
    const eventTitle = info.eventType === 'upload'
      ? `Video Upload: ${info.displayName || info.channelName} published a video`
      : `Stream Alert: ${info.displayName || info.channelName} went LIVE`;

    recordLiveEvent({
      guild_id: tracker.guild_id,
      type: 'game',
      title: eventTitle,
      description: `${info.title} (${info.game || 'Content'}) on ${info.platform.toUpperCase()}`,
      severity: 'success',
      metadata: {
        platform: info.platform,
        channel: info.channelName,
        url: info.streamUrl,
        eventType: info.eventType || 'live',
      }
    });

    logger.info({ guildId: tracker.guild_id, streamer: info.channelName, channelId: channel.id, platform: info.platform, type: info.eventType }, '[RADAR] Stream notification dispatched to Discord successfully');
    return true;
  } catch (err) {
    logger.error({ err, trackerId: tracker.id }, 'Failed to dispatch stream notification');
    return false;
  }
}

/**
 * Send a verified test notification (Stream or Video) to the target channel
 */
export async function testStreamNotification(
  bot: Client,
  guildId: string,
  tracker: Partial<StreamTrackerRow>
): Promise<{ channelName: string; platform: string }> {
  if (!tracker.discord_channel_id) {
    throw new Error('Please select a Discord target channel for the stream alert.');
  }

  const channel = (await bot.channels.fetch(tracker.discord_channel_id).catch(() => null)) as TextChannel;
  if (!channel || !channel.isTextBased()) {
    throw new Error('Target Discord channel not found or bot lacks permissions.');
  }

  const platform = tracker.platform || 'twitch';
  const channelName = tracker.channel_name || 'nexus_creator';
  const isUploadTest = tracker.event_type === 'upload';

  // Build simulated stream or video upload info
  const testInfo: StreamInfo = {
    isLive: !isUploadTest,
    eventType: isUploadTest ? 'upload' : 'live',
    platform,
    channelName,
    displayName: tracker.display_name || channelName,
    title: isUploadTest
      ? `🎬 [TEST VIDEO] Brand New Gaming Guide & Full Walkthrough!`
      : `🔥 [TEST BROADCAST] Epic Gaming & Community Hangout!`,
    game: isUploadTest ? 'Video Upload' : (platform === 'kick' ? 'Grand Theft Auto V' : (platform === 'youtube' ? 'Valorant' : 'AION 2')),
    viewers: isUploadTest ? undefined : 1337,
    avatarUrl: platform === 'twitch'
      ? 'https://static-cdn.jtvnw.net/jtv_user_pictures/c754eebf-745b-4e0a-814a-10bcaecaabbc-profile_image-300x300.png'
      : (platform === 'kick' ? 'https://files.kick.com/images/user/62/profile_image/conversion/300.webp' : 'https://cdn.discordapp.com/embed/avatars/0.png'),
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1280&auto=format&fit=crop',
    streamUrl: platform === 'twitch' ? `https://twitch.tv/${channelName}` : (platform === 'kick' ? `https://kick.com/${channelName}` : `https://youtube.com/@${channelName}`)
  };

  const { embed, row, content } = buildStreamEmbed(tracker, testInfo);

  await channel.send({
    content: `🧪 **[TEST ${isUploadTest ? 'VIDEO' : 'STREAM'} ALERT]** ${content}`,
    embeds: [embed],
    components: [row]
  });

  // Record into Dashboard feed
  recordLiveEvent({
    guild_id: guildId,
    type: 'system',
    title: `Test ${isUploadTest ? 'Video' : 'Stream'} Alert: ${testInfo.displayName}`,
    description: `Dispatched test ${platform.toUpperCase()} alert to #${channel.name}`,
    severity: 'success'
  });

  return { channelName: channel.name, platform };
}

/**
 * Background Stream Radar Polling Loop
 * Runs every 45 seconds to detect streamers going live
 */
export function startStreamWatcher(bot: Client) {
  logger.info('[RADAR] Initializing Multi-Platform Stream Radar watcher (Twitch, Kick, YouTube)...');

  // Initial check after 5 seconds, then every 45 seconds
  setTimeout(() => pollTrackedStreams(bot), 5000);
  setInterval(() => pollTrackedStreams(bot), 45000);
}

async function pollTrackedStreams(bot: Client) {
  try {
    const res = await db.query<StreamTrackerRow>(
      `SELECT * FROM stream_trackers ORDER BY last_checked_at ASC NULLS FIRST LIMIT 100`
    );

    if (res.rows.length === 0) return;

    for (const tracker of res.rows) {
      try {
        const streamInfo = await fetchStreamInfo(tracker.platform, tracker.channel_name);

        const eventMode = tracker.event_type || 'all';

        // 1. Live Stream Transition Check
        if (eventMode !== 'upload') {
          const isNewStream = streamInfo.isLive && (!tracker.is_live || (streamInfo.streamId && tracker.last_stream_id !== streamInfo.streamId));
          if (isNewStream) {
            logger.info(`[RADAR] Streamer ${tracker.channel_name} (${tracker.platform}) went LIVE: ${streamInfo.title}`);
            const sent = await dispatchStreamNotification(bot, tracker, streamInfo);
            logger.info({ sent, trackerId: tracker.id }, '[RADAR] Stream live alert dispatched');

            await db.query(
              `UPDATE stream_trackers 
               SET is_live = TRUE, 
                   last_stream_id = $1, 
                   last_title = $2, 
                   last_game = $3, 
                   last_checked_at = NOW() 
               WHERE id = $4`,
              [streamInfo.streamId || null, streamInfo.title, streamInfo.game, tracker.id]
            );
            continue;
          } else if (tracker.is_live && !streamInfo.isLive) {
            logger.info(`[RADAR] Streamer ${tracker.channel_name} (${tracker.platform}) concluded stream.`);
            await db.query(
              `UPDATE stream_trackers SET is_live = FALSE, last_checked_at = NOW() WHERE id = $1`,
              [tracker.id]
            );
            continue;
          } else if (streamInfo.isLive && tracker.is_live) {
            await db.query(
              `UPDATE stream_trackers SET last_title = $1, last_checked_at = NOW() WHERE id = $2`,
              [streamInfo.title, tracker.id]
            );
            continue;
          }
        }

        // 2. Video Upload Transition Check (for YouTube or upload-enabled trackers)
        if (eventMode !== 'live' && streamInfo.eventType === 'upload' && streamInfo.streamId) {
          if (!tracker.last_stream_id) {
            // Establish baseline so historical videos aren't blasted retroactively
            await db.query(
              `UPDATE stream_trackers SET last_stream_id = $1, last_title = $2, last_checked_at = NOW() WHERE id = $3`,
              [streamInfo.streamId, streamInfo.title, tracker.id]
            );
          } else if (tracker.last_stream_id !== streamInfo.streamId) {
            logger.info(`[RADAR] Creator ${tracker.channel_name} (${tracker.platform}) published a new video: ${streamInfo.title}`);
            await dispatchStreamNotification(bot, tracker, streamInfo);

            await db.query(
              `UPDATE stream_trackers 
               SET last_stream_id = $1, 
                   last_title = $2, 
                   last_checked_at = NOW() 
               WHERE id = $3`,
              [streamInfo.streamId, streamInfo.title, tracker.id]
            );
            continue;
          }
        }

        // Update last checked timestamp
        await db.query(
          `UPDATE stream_trackers SET last_checked_at = NOW() WHERE id = $1`,
          [tracker.id]
        );
      } catch (err) {
        logger.error({ err, trackerId: tracker.id }, '[RADAR] Error checking tracker');
      }
    }
  } catch (err) {
    logger.error({ err }, '[RADAR] Failed to poll tracked streams');
  }
}
