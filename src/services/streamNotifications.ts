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
 * Safe fetch helpers that always consume response bodies to prevent
 * unhandled socket leaks and Windows libuv UV_HANDLE_CLOSING assertion crashes.
 */
async function fetchSafeText(url: string | URL | Request, init?: RequestInit): Promise<string | null> {
  try {
    const res = await fetch(url, init);
    const body = await res.text();
    return res.ok ? body : null;
  } catch {
    return null;
  }
}

async function fetchSafeJson<T = any>(url: string | URL | Request, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok || !text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Clean and normalize streamer channel inputs across Twitch, Kick, and YouTube
 */
export function normalizeChannelInput(platform: 'twitch' | 'youtube' | 'kick', rawInput: string): { cleanName: string; channelId?: string } {
  let trimmed = rawInput.trim();

  if (platform === 'youtube') {
    // 1. Direct channel ID match
    const directUc = trimmed.match(/^(UC[a-zA-Z0-9_-]{22})$/i);
    if (directUc) return { cleanName: directUc[1], channelId: directUc[1] };

    // 2. URL parsing (youtube.com/channel/UC..., youtube.com/@handle, etc.)
    const urlChannel = trimmed.match(/(?:youtube\.com\/channel\/)(UC[a-zA-Z0-9_-]{22})/i);
    if (urlChannel) return { cleanName: urlChannel[1], channelId: urlChannel[1] };

    const urlHandle = trimmed.match(/(?:youtube\.com\/@|youtu\.be\/|youtube\.com\/c\/|youtube\.com\/user\/)([\w.-]+)/i);
    if (urlHandle) {
      const h = urlHandle[1].toLowerCase();
      return { cleanName: h, channelId: KNOWN_CHANNEL_IDS[h] };
    }

    // 3. Raw handle or name
    const cleaned = trimmed.replace(/^@/, '').replace(/[\/@]/g, '').trim().toLowerCase();
    return { cleanName: cleaned, channelId: KNOWN_CHANNEL_IDS[cleaned] };
  }

  // Twitch & Kick
  const clean = trimmed
    .replace(/^https?:\/\/(www\.)?(twitch\.tv|kick\.com)\//i, '')
    .replace(/[\/@]/g, '')
    .trim()
    .toLowerCase();

  return { cleanName: clean };
}

/**
 * Multi-Platform Stream & Upload Status Fetcher
 * Inspects Twitch, Kick, and YouTube for live streams and recent video uploads
 */
export async function fetchStreamInfo(
  platform: 'twitch' | 'youtube' | 'kick',
  rawChannel: string
): Promise<StreamInfo> {
  const { cleanName, channelId: knownId } = normalizeChannelInput(platform, rawChannel);

  // 1. TWITCH STREAM CHECK
  if (platform === 'twitch') {
    try {
      const uptimeText = (await fetchSafeText(`https://decapi.me/twitch/uptime/${cleanName}`, {
        headers: { 'User-Agent': 'SRB-NEXUS-Bot/2.5' }
      })) || '';

      const isOffline = uptimeText.toLowerCase().includes('offline') ||
                        uptimeText.toLowerCase().includes('not found') ||
                        uptimeText.length === 0;

      const avatarUrl = await fetchSafeText(`https://decapi.me/twitch/avatar/${cleanName}`);
      const title = (await fetchSafeText(`https://decapi.me/twitch/title/${cleanName}`)) || 'Live Stream';
      const game = (await fetchSafeText(`https://decapi.me/twitch/game/${cleanName}`)) || 'Just Chatting';
      const viewersStr = (await fetchSafeText(`https://decapi.me/twitch/viewercount/${cleanName}`)) || '0';
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
        thumbnailUrl: !isOffline ? `https://static-cdn.jtvnw.net/previews-ttv/live_user_${cleanName}-1920x1080.jpg?t=${Date.now()}` : undefined,
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
      // First try v1 channels API
      const data = await fetchSafeJson<any>(`https://kick.com/api/v1/channels/${cleanName}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      if (data) {
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

      // Secondary fallback to v2 livestream endpoint
      const v2Data = await fetchSafeJson<any>(`https://kick.com/api/v2/channels/${cleanName}/livestream`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      if (v2Data && v2Data.data) {
        const ls = v2Data.data;
        return {
          isLive: Boolean(ls.is_live),
          platform: 'kick',
          channelName: cleanName,
          displayName: cleanName,
          title: ls.session_title || 'Live on Kick',
          game: ls.category?.name || 'Just Chatting',
          viewers: ls.viewer_count || 0,
          avatarUrl: ls.channel?.user?.profile_pic || undefined,
          thumbnailUrl: ls.thumbnail?.url || undefined,
          streamUrl: `https://kick.com/${cleanName}`,
          streamId: ls.id ? String(ls.id) : undefined
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
      let isLive = false;
      let liveTitle = '';
      let liveVideoId = '';
      let liveThumbnail = '';
      let channelId = knownId || '';
      let authorName = '';

      if (cleanName.startsWith('uc') && cleanName.length === 24) {
        channelId = cleanName;
      }

      // Step 1: Query YouTube InnerTube resolve_url API for active live stream
      try {
        const resolveTarget = channelId
          ? `https://www.youtube.com/channel/${channelId}/live`
          : `https://www.youtube.com/@${cleanName}/live`;

        const resolveData = await fetchSafeJson<any>('https://www.youtube.com/youtubei/v1/navigation/resolve_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: resolveTarget,
            context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } }
          }),
          signal: AbortSignal.timeout(6000)
        });

        if (resolveData) {
          const endpoint = resolveData.endpoint;
          const candidateVideoId = endpoint?.watchEndpoint?.videoId;
          const pageType = endpoint?.commandMetadata?.webCommandMetadata?.webPageType;

          if (endpoint?.browseEndpoint?.browseId && !channelId) {
            channelId = endpoint.browseEndpoint.browseId;
          }

          if (candidateVideoId && pageType === 'WEB_PAGE_TYPE_WATCH') {
            isLive = true;
            liveVideoId = candidateVideoId;
            liveTitle = 'Live on YouTube';
            liveThumbnail = `https://i.ytimg.com/vi/${candidateVideoId}/maxresdefault.jpg`;

            // Enrich metadata via official YouTube oEmbed API
            try {
              const oeData = await fetchSafeJson<any>(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${candidateVideoId}&format=json`, {
                signal: AbortSignal.timeout(5000)
              });
              if (oeData) {
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
        logger.warn({ err, cleanName }, '[RADAR] Failed during YouTube InnerTube live resolve');
      }

      // Step 2: Fallback / Secondary RSS Check for recent video upload
      let latestVideoId = '';
      let latestVideoTitle = '';
      let latestVideoUrl = `https://youtube.com/@${cleanName}`;
      let latestThumbnail = '';
      let isCandidateStreamVOD = false;

      if (!isLive && channelId) {
        try {
          const xml = await fetchSafeText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}&t=${Date.now()}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(6000)
          });
          if (xml) {
            const idMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = xml.match(/<media:title>(.*?)<\/media:title>/) || xml.match(/<title>(.*?)<\/title>/);
            const authorTag = xml.match(/<author>\s*<name>(.*?)<\/name>/);
            if (authorTag && authorTag[1]) authorName = authorTag[1];

            if (idMatch && idMatch[1]) {
              const candidateId = idMatch[1];
              const candidateTitle = titleMatch ? titleMatch[1].trim() : 'New YouTube Video';

              // Inspect candidate video via InnerTube player API to distinguish live streams/VODs from true uploads
              try {
                const pData = await fetchSafeJson<any>('https://www.youtube.com/youtubei/v1/player', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    videoId: candidateId,
                    context: { client: { clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US' } }
                  }),
                  signal: AbortSignal.timeout(5000)
                });

                if (pData) {
                  const vr = pData.videoDetails;
                  if (vr?.isLiveContent || vr?.isLive || pData.playabilityStatus?.liveStreamability) {
                    isCandidateStreamVOD = true;
                  }
                }
              } catch (pErr) {
                logger.warn({ pErr, candidateId }, '[RADAR] Failed checking candidate video player API');
              }

              if (!isCandidateStreamVOD) {
                latestVideoId = candidateId;
                latestVideoTitle = candidateTitle;
                latestVideoUrl = `https://www.youtube.com/watch?v=${candidateId}`;
                latestThumbnail = `https://i.ytimg.com/vi/${candidateId}/maxresdefault.jpg`;
              }
            }
          }
        } catch (rssErr) {
          logger.warn({ rssErr, channelId }, '[RADAR] Failed to fetch YouTube RSS feed');
        }
      }

      // Step 3: Package final StreamInfo
      if (isLive && liveVideoId) {
        return {
          isLive: true,
          platform: 'youtube',
          eventType: 'live',
          channelName: cleanName,
          displayName: authorName || cleanName,
          title: liveTitle || 'Live Stream on YouTube',
          game: 'YouTube Live',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
          thumbnailUrl: liveThumbnail,
          streamUrl: `https://www.youtube.com/watch?v=${liveVideoId}`,
          streamId: liveVideoId
        };
      } else if (latestVideoId) {
        return {
          isLive: false,
          platform: 'youtube',
          eventType: 'upload',
          channelName: cleanName,
          displayName: authorName || cleanName,
          title: latestVideoTitle || 'New YouTube Video',
          game: 'Video Upload',
          avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
          thumbnailUrl: latestThumbnail,
          streamUrl: latestVideoUrl,
          streamId: latestVideoId
        };
      }

      return {
        isLive: false,
        platform: 'youtube',
        eventType: 'live',
        channelName: cleanName,
        displayName: authorName || cleanName,
        title: 'Offline',
        game: 'Offline',
        streamUrl: `https://youtube.com/@${cleanName}`
      };
    } catch (err) {
      logger.error({ err, cleanName }, 'Failed to fetch YouTube channel status');
      return {
        isLive: false,
        platform: 'youtube',
        channelName: cleanName,
        displayName: cleanName,
        title: 'Offline',
        game: 'Offline',
        streamUrl: `https://youtube.com/@${cleanName}`,
      };
    }
  }

  return {
    isLive: false,
    platform,
    channelName: cleanName,
    displayName: cleanName,
    title: 'Offline',
    game: 'Offline',
    streamUrl: `https://${platform}.com/${cleanName}`
  };
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
  let btnLabel = '🔴 Watch Live on Twitch';
  let platformIcon = 'https://assets.help.twitch.tv/Glitch_Purple_RGB.png';

  if (info.platform === 'kick') {
    color = '#53FC18';
    badge = '🟢 KICK';
    btnLabel = '🔴 Watch Live on Kick';
    platformIcon = 'https://files.kick.com/images/user/62/profile_image/conversion/300.webp';
  } else if (info.platform === 'youtube') {
    color = '#FF0000';
    badge = '🔴 YOUTUBE';
    btnLabel = isVideoUpload ? '🎬 Watch New Video' : (isPremiere ? '⭐ Watch Premiere' : '🔴 Watch Live on YouTube');
    platformIcon = 'https://www.youtube.com/s/desktop/f7be2d12/img/favicon_144x144.png';
  }

  const alertTypeLabel = isVideoUpload
    ? 'NEW VIDEO UPLOAD'
    : (isPremiere ? 'VIDEO PREMIERE' : 'LIVE STREAM ALERT');

  const titleHeader = isVideoUpload
    ? `🎬 ${info.displayName || info.channelName} published a new video!`
    : (isPremiere
        ? `⭐ ${info.displayName || info.channelName} is premiering a video!`
        : `🔴 ${info.displayName || info.channelName} is now LIVE!`);

  const startedTimestamp = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: `${badge} • ${alertTypeLabel}`,
      iconURL: info.avatarUrl || platformIcon,
      url: info.streamUrl
    })
    .setTitle(titleHeader)
    .setURL(info.streamUrl)
    .setDescription(`### [${info.title || (isVideoUpload ? 'New Video' : 'Live Broadcast')}](${info.streamUrl})`)
    .addFields(
      {
        name: isVideoUpload ? '📂 Content Type' : '🎮 Category / Game',
        value: `\`${isVideoUpload ? 'Video Upload' : (info.game || 'Just Chatting')}\``,
        inline: true
      },
      {
        name: isVideoUpload ? '🕒 Status' : '👥 Live Viewers',
        value: isVideoUpload ? '`Uploaded & Ready`' : `\`${info.viewers ? info.viewers.toLocaleString() : 'Live Now'}\``,
        inline: true
      },
      {
        name: isVideoUpload ? '🕒 Published' : '⏱️ Started',
        value: `<t:${startedTimestamp}:R>`,
        inline: true
      },
      { name: '🌐 Platform', value: `**${info.platform.toUpperCase()}**`, inline: true }
    )
    .setFooter({
      text: 'SRB NEXUS Stream Radar • Real-Time Alert',
      iconURL: 'https://srb-nexus-awgm.onrender.com/nexus-logo.png'
    })
    .setTimestamp();

  if (info.thumbnailUrl) {
    embed.setImage(info.thumbnailUrl);
  }
  if (info.avatarUrl) {
    embed.setThumbnail(info.avatarUrl);
  }

  // Primary Watch Button
  const watchBtn = new ButtonBuilder()
    .setLabel(btnLabel)
    .setStyle(ButtonStyle.Link)
    .setURL(info.streamUrl);

  // Secondary Creator Channel Profile Button
  let channelUrl = info.streamUrl;
  if (info.platform === 'twitch') {
    channelUrl = `https://twitch.tv/${info.channelName}`;
  } else if (info.platform === 'kick') {
    channelUrl = `https://kick.com/${info.channelName}`;
  } else if (info.platform === 'youtube') {
    channelUrl = info.channelName.startsWith('UC')
      ? `https://youtube.com/channel/${info.channelName}`
      : `https://youtube.com/@${info.channelName.replace(/^@/, '')}`;
  }

  const channelBtn = new ButtonBuilder()
    .setLabel('Creator Channel')
    .setEmoji('📺')
    .setStyle(ButtonStyle.Link)
    .setURL(channelUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(watchBtn, channelBtn);

  // Formulate mention text
  let mention = '';
  if (tracker.mention_role === 'everyone') {
    mention = '@everyone ';
  } else if (tracker.mention_role === 'here') {
    mention = '@here ';
  } else if (tracker.mention_role && tracker.mention_role !== 'none') {
    mention = `<@&${tracker.mention_role}> `;
  }

  const typeDisplay = isVideoUpload ? 'video' : (isPremiere ? 'premiere' : 'live stream');

  let defaultTemplate = isVideoUpload
    ? '{streamer} just uploaded a new video on {platform}! 🎬'
    : (isPremiere
        ? '{streamer} is premiering a new video on {platform}! ⭐'
        : '{streamer} is now LIVE on {platform}! 🔴');

  let customText = tracker.custom_message || defaultTemplate;

  // Auto-adapt message if custom template doesn't match event type
  if (isVideoUpload && customText.includes('is now LIVE')) {
    customText = customText.replace(/is now LIVE/gi, 'just uploaded a new video').replace(/🔴/g, '🎬');
  } else if (!isVideoUpload && (customText.includes('uploaded a new video') || customText.includes('published new video'))) {
    customText = customText.replace(/uploaded a new video|published new video/gi, 'is now LIVE').replace(/🎬/g, '🔴');
  }

  customText = customText
    .replace(/{streamer}/g, `**${info.displayName || info.channelName}**`)
    .replace(/{platform}/g, info.platform.toUpperCase())
    .replace(/{title}/g, info.title || 'New Release')
    .replace(/{game}/g, info.game || 'Streaming')
    .replace(/{type}/g, typeDisplay)
    .replace(/{url}/g, info.streamUrl)
    .replace(/{viewers}/g, info.viewers ? String(info.viewers) : 'Live')
    .replace(/\bnew new\b/gi, 'new');

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
    game: isUploadTest ? 'Video Upload' : (platform === 'kick' ? 'Grand Theft Auto V' : (platform === 'youtube' ? 'Valorant' : 'Just Chatting')),
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
 * Runs every 25 seconds for sub-minute live detection
 */
export function startStreamWatcher(bot: Client) {
  logger.info('[RADAR] Initializing Multi-Platform Stream Radar watcher (Twitch, Kick, YouTube at 25s polling frequency)...');

  // Initial check after 3 seconds, then every 25 seconds
  setTimeout(() => pollTrackedStreams(bot), 3000);
  setInterval(() => pollTrackedStreams(bot), 25000);
}

async function pollTrackedStreams(bot: Client) {
  try {
    // Select tracked streamers with guild settings to check if stream notifications are enabled
    const res = await db.query<StreamTrackerRow & { notif_stream_alerts?: boolean }>(
      `SELECT st.*, COALESCE(gs.notif_stream_alerts, TRUE) as notif_stream_alerts
       FROM stream_trackers st
       LEFT JOIN guild_settings gs ON st.guild_id = gs.guild_id
       ORDER BY st.last_checked_at ASC NULLS FIRST LIMIT 100`
    );

    if (res.rows.length === 0) return;

    for (const tracker of res.rows) {
      try {
        const streamInfo = await fetchStreamInfo(tracker.platform, tracker.channel_name);

        const eventMode = tracker.event_type || 'all';
        const streamAlertsGloballyEnabled = tracker.notif_stream_alerts !== false;

        // 1. Live Stream Transition Check
        if (eventMode !== 'upload') {
          const isNewStream = streamInfo.isLive && (!tracker.is_live || (streamInfo.streamId && tracker.last_stream_id !== streamInfo.streamId));
          if (isNewStream) {
            logger.info(`[RADAR] Streamer ${tracker.channel_name} (${tracker.platform}) went LIVE: ${streamInfo.title}`);

            if (streamAlertsGloballyEnabled) {
              const sent = await dispatchStreamNotification(bot, tracker, streamInfo);
              logger.info({ sent, trackerId: tracker.id }, '[RADAR] Stream live alert dispatched');
            } else {
              logger.info({ trackerId: tracker.id }, '[RADAR] Stream alerts disabled in guild settings. Skipping dispatch.');
            }

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
              `UPDATE stream_trackers SET is_live = FALSE, last_stream_id = COALESCE($1, last_stream_id), last_checked_at = NOW() WHERE id = $2`,
              [streamInfo.streamId || null, tracker.id]
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
          const isSameAsLive =
            tracker.last_stream_id === streamInfo.streamId ||
            (tracker.last_title &&
              streamInfo.title &&
              tracker.last_title.trim().toLowerCase() === streamInfo.title.trim().toLowerCase());

          if (isSameAsLive) {
            logger.info(
              { trackerId: tracker.id, title: streamInfo.title },
              '[RADAR] Video upload matches recent live stream. Skipping upload notification.'
            );
            await db.query(
              `UPDATE stream_trackers SET last_stream_id = $1, last_checked_at = NOW() WHERE id = $2`,
              [streamInfo.streamId, tracker.id]
            );
            continue;
          }

          const isNewUpload = tracker.last_stream_id !== streamInfo.streamId;
          if (isNewUpload) {
            logger.info(`[RADAR] New video upload detected for ${tracker.channel_name} (YouTube): ${streamInfo.title}`);

            if (streamAlertsGloballyEnabled) {
              const sent = await dispatchStreamNotification(bot, tracker, streamInfo);
              logger.info({ sent, trackerId: tracker.id }, '[RADAR] Video upload alert dispatched');
            } else {
              logger.info({ trackerId: tracker.id }, '[RADAR] Stream alerts disabled in guild settings. Skipping dispatch.');
            }

            await db.query(
              `UPDATE stream_trackers 
               SET last_stream_id = $1, 
                   last_title = $2, 
                   last_game = $3, 
                   last_checked_at = NOW() 
               WHERE id = $4`,
              [streamInfo.streamId, streamInfo.title, streamInfo.game, tracker.id]
            );
            continue;
          }
        }

        // Touch last_checked_at
        await db.query(`UPDATE stream_trackers SET last_checked_at = NOW() WHERE id = $1`, [tracker.id]);
      } catch (trackerErr) {
        logger.warn({ trackerErr, trackerId: tracker.id }, '[RADAR] Error polling specific streamer');
      }
    }
  } catch (err) {
    logger.error({ err }, '[RADAR] Error in pollTrackedStreams batch query');
  }
}
