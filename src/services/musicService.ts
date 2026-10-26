import {
  Player,
  GuildQueue,
  Track,
  QueueRepeatMode,
  SearchResult,
  QueryType,
} from 'discord-player';
import { DefaultExtractors } from '@discord-player/extractor';
import { YoutubeExtractor } from 'discord-player-youtubei';
import {
  Client,
  GuildMember,
  VoiceBasedChannel,
  TextBasedChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  Message,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

let musicPlayer: Player | null = null;

export interface MusicGuildSettings {
  guild_id: string;
  dj_role_id: string | null;
  default_volume: number;
  max_queue_length: number;
  enabled: boolean;
}

export function getMusicPlayer(): Player {
  if (!musicPlayer) {
    throw new Error('Music player has not been initialized yet.');
  }
  return musicPlayer;
}

export function getRepeatModeLabel(mode: QueueRepeatMode): string {
  switch (mode) {
    case QueueRepeatMode.TRACK:
      return '🔂 Track';
    case QueueRepeatMode.QUEUE:
      return '🔁 Queue';
    case QueueRepeatMode.AUTOPLAY:
      return '📻 Autoplay';
    case QueueRepeatMode.OFF:
    default:
      return 'Off';
  }
}

export function getSourceEmoji(source: string): string {
  switch (source?.toLowerCase()) {
    case 'youtube':
      return '🔴 YouTube';
    case 'spotify':
      return '🟢 Spotify';
    case 'soundcloud':
      return '🟠 SoundCloud';
    case 'apple_music':
    case 'applemusic':
      return '🍎 Apple Music';
    case 'attachment':
    case 'arbitrary':
      return '📁 Direct File';
    case 'vimeo':
      return '🔷 Vimeo';
    default:
      return '🎵 Web Stream';
  }
}

export async function getMusicSettings(guildId: string): Promise<MusicGuildSettings> {
  try {
    const res = await db.query(
      'SELECT guild_id, dj_role_id, default_volume, max_queue_length, enabled FROM module_music WHERE guild_id = $1',
      [guildId]
    );
    if (res.rows.length > 0) {
      return {
        guild_id: res.rows[0].guild_id,
        dj_role_id: res.rows[0].dj_role_id || null,
        default_volume: Number(res.rows[0].default_volume ?? 80),
        max_queue_length: Number(res.rows[0].max_queue_length ?? 100),
        enabled: res.rows[0].enabled ?? true,
      };
    }
  } catch (err) {
    logger.error({ err, guildId }, '[MUSIC] Failed to load guild music settings, using defaults');
  }

  return {
    guild_id: guildId,
    dj_role_id: null,
    default_volume: 80,
    max_queue_length: 100,
    enabled: true,
  };
}

export async function canControlPlayback(
  member: GuildMember,
  queue?: GuildQueue | null
): Promise<{ allowed: boolean; reason?: string }> {
  const settings = await getMusicSettings(member.guild.id);
  if (!settings.enabled) {
    return { allowed: false, reason: 'Music module is currently disabled by server administrators.' };
  }

  // Administrators and Manage Server have master control
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return { allowed: true };
  }

  // Check DJ role if configured
  if (settings.dj_role_id) {
    if (member.roles.cache.has(settings.dj_role_id)) {
      return { allowed: true };
    }

    // Allow if user is alone with the bot in voice
    if (queue && queue.channel) {
      const nonBots = queue.channel.members.filter((m) => !m.user.bot);
      if (nonBots.size === 1 && nonBots.has(member.id)) {
        return { allowed: true };
      }
    }

    // Allow if the user requested the current track
    if (queue?.currentTrack?.requestedBy?.id === member.id) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `You require the <@&${settings.dj_role_id}> DJ role to control playback.`,
    };
  }

  return { allowed: true };
}

export function buildMusicControlRow(isPaused: boolean, repeatMode: QueueRepeatMode): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setLabel(isPaused ? 'Resume' : 'Pause')
      .setEmoji(isPaused ? '▶️' : '⏸️')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('Skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('Stop')
      .setEmoji('⏹️')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_shuffle')
      .setLabel('Shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel(`Loop: ${getRepeatModeLabel(repeatMode).split(' ')[0]}`)
      .setEmoji('🔁')
      .setStyle(repeatMode !== QueueRepeatMode.OFF ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return row;
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function renderProgressBar(queue: GuildQueue, track: Track): string {
  const isPaused = queue.node.isPaused();
  const currentMs = Math.max(0, queue.node.playbackTime || 0);
  const totalMs = Math.max(0, track.durationMS || 0);
  const isLive = track.live || totalMs <= 0;

  if (isLive) {
    return `\`${formatDurationMs(currentMs)}\` | 🔴 **LIVE STREAM**`;
  }

  const length = 12;
  const ratio = totalMs > 0 ? Math.min(Math.max(currentMs / totalMs, 0), 1) : 0;
  const index = Math.round(ratio * length);
  const left = '▬'.repeat(index);
  const right = '▬'.repeat(Math.max(0, length - index));
  const bar = `${left}🔘${right}`;

  const currentStr = formatDurationMs(currentMs);
  const totalStr = track.duration || formatDurationMs(totalMs);

  if (isPaused) {
    return `\`${currentStr}\` | ${bar} | \`${totalStr}\` • ⏸️ *Paused*`;
  }

  const remainingMs = Math.max(0, totalMs - currentMs);
  const endUnix = Math.floor((Date.now() + remainingMs) / 1000);

  return `\`${currentStr}\` | ${bar} | \`${totalStr}\` • Ends <t:${endUnix}:R>`;
}

export function buildNowPlayingEmbed(queue: GuildQueue, track: Track): EmbedBuilder {
  const isPaused = queue.node.isPaused();
  const progressText = renderProgressBar(queue, track);

  const nextTrack = queue.tracks.at(0);
  const upNextStr = nextTrack
    ? `**Up Next:** [${nextTrack.title.length > 50 ? nextTrack.title.slice(0, 47) + '...' : nextTrack.title}](${nextTrack.url}) • \`${nextTrack.duration}\``
    : `**Up Next:** *End of queue*`;

  const embed = new EmbedBuilder()
    .setColor(isPaused ? 0xf59e0b : 0x5865f2)
    .setAuthor({
      name: isPaused ? '⏸️ Music Paused' : '🎵 Now Playing',
      iconURL: queue.player.client.user?.displayAvatarURL(),
    })
    .setTitle(track.title.length > 100 ? track.title.slice(0, 97) + '...' : track.title)
    .setURL(track.url || 'https://discord.com')
    .setDescription(
      `**Artist / Author:** \`${track.author || 'Unknown'}\`\n` +
      `**Duration & Progress:**\n${progressText}\n\n` +
      `**Platform:** ${getSourceEmoji(track.raw?.source || track.source || 'youtube')}\n` +
      `**Requested By:** <@${track.requestedBy?.id || 'Unknown'}>\n\n` +
      `${upNextStr}`
    )
    .addFields(
      { name: '🔊 Volume', value: `\`${queue.node.volume}%\``, inline: true },
      { name: '🔁 Loop Mode', value: `\`${getRepeatModeLabel(queue.repeatMode)}\``, inline: true },
      { name: '📑 Songs In Queue', value: `\`${queue.tracks.size} track(s)\``, inline: true }
    )
    .setFooter({
      text: `SRB NEXUS High-Fidelity Audio • Guild: ${queue.guild.name}`,
    })
    .setTimestamp();

  if (track.thumbnail) {
    embed.setThumbnail(track.thumbnail);
  }

  return embed;
}

export function stopPlayerProgressTicker(queue: GuildQueue<any>): void {
  if (queue.metadata?.progressTimer) {
    clearTimeout(queue.metadata.progressTimer);
    queue.metadata.progressTimer = null;
  }
  if (queue.metadata?.progressInterval) {
    clearInterval(queue.metadata.progressInterval);
    queue.metadata.progressInterval = null;
  }
}

export function startPlayerProgressTicker(
  queue: GuildQueue<any>,
  track: Track,
  msg: Message
): void {
  stopPlayerProgressTicker(queue);

  if (!queue.metadata) {
    queue.metadata = {} as any;
  }
  queue.metadata.lastPlayerMessage = msg;

  let active = true;

  const tick = async () => {
    if (!active) return;

    try {
      // If queue is deleted or has stopped playing or has no track, cease ticker
      if (queue.deleted || !queue.isPlaying() || !queue.currentTrack) {
        stopPlayerProgressTicker(queue);
        return;
      }

      // Check that the currently playing track matches
      const current = queue.currentTrack;
      if (
        current.id !== track.id &&
        current.url !== track.url &&
        current.title !== track.title
      ) {
        stopPlayerProgressTicker(queue);
        return;
      }

      // If not paused, update the embed card with current progress and fresh end timestamp
      if (!queue.node.isPaused()) {
        const embed = buildNowPlayingEmbed(queue, current);
        const row = buildMusicControlRow(false, queue.repeatMode);

        await msg.edit({
          embeds: [embed],
          components: [row],
        });
      }
    } catch (err: any) {
      // If message was deleted (10008) or channel missing (10003) or 404
      if (err?.code === 10008 || err?.code === 10003 || err?.status === 404) {
        active = false;
        stopPlayerProgressTicker(queue);
        if (queue.metadata?.lastPlayerMessage?.id === msg.id) {
          queue.metadata.lastPlayerMessage = null;
        }
        return;
      }

      // If rate limited (429), respect retry_after and back off gracefully
      if (err?.status === 429) {
        const retryAfterSec = Number(err?.retry_after ?? 6);
        const backoffMs = Math.max(7000, retryAfterSec * 1000);
        logger.warn(
          { retryAfterSec, backoffMs, guildId: queue.guild.id },
          '[MUSIC] Rate limited updating player progress card, backing off'
        );
        if (active && queue.metadata) {
          queue.metadata.progressTimer = setTimeout(tick, backoffMs);
        }
        return;
      }

      logger.debug(
        { err: err?.message, guildId: queue.guild.id },
        '[MUSIC] Non-fatal error while updating player progress card'
      );
    }

    // Schedule next tick after 6 seconds
    if (active && queue.metadata) {
      queue.metadata.progressTimer = setTimeout(tick, 6000);
    }
  };

  // Schedule initial tick after 6 seconds
  queue.metadata.progressTimer = setTimeout(tick, 6000);
}

export async function initMusicService(client: Client): Promise<Player> {
  if (musicPlayer) {
    return musicPlayer;
  }

  logger.info('[MUSIC] Initializing Discord Player music engine...');

  const player = new Player(client as any, {
    skipFFmpeg: false,
  });

  // Register DefaultExtractors (SoundCloud, Spotify, Apple Music, Attachments, Vimeo)
  try {
    await player.extractors.loadMulti(DefaultExtractors);
    logger.info('[MUSIC] Loaded DefaultExtractors successfully.');
  } catch (err) {
    logger.error({ err }, '[MUSIC] Error loading DefaultExtractors');
  }

  // Register YoutubeExtractor from discord-player-youtubei
  try {
    await player.extractors.register(YoutubeExtractor, {});
    logger.info('[MUSIC] Registered YoutubeExtractor successfully.');
  } catch (err) {
    logger.error({ err }, '[MUSIC] Error registering YoutubeExtractor');
  }

  // Setup Player Events
  player.events.on('playerStart', async (queue: GuildQueue<any>, track: Track) => {
    try {
      const channel = queue.metadata?.channel as any;
      if (!channel || typeof channel.send !== 'function') return;

      // If the initiating command (/play or !play) already rendered the player card for this track,
      // suppress sending a duplicate card in the channel to prevent "double data"
      if (queue.metadata?.suppressPlayerStartMessage) {
        queue.metadata.suppressPlayerStartMessage = false;
        if (queue.metadata?.lastPlayerMessage) {
          startPlayerProgressTicker(queue, track, queue.metadata.lastPlayerMessage as Message);
        }
        return;
      }

      // Clean up buttons on previous player card if one existed
      if (queue.metadata?.lastPlayerMessage) {
        try {
          const oldMsg = queue.metadata.lastPlayerMessage as Message;
          oldMsg.edit({ components: [] }).catch(() => {});
        } catch {}
      }

      const embed = buildNowPlayingEmbed(queue, track);
      const row = buildMusicControlRow(queue.node.isPaused(), queue.repeatMode);

      const msg = await channel.send({
        embeds: [embed],
        components: [row],
      });

      // Start live progress ticker (updates progress bar & elapsed duration every 6s)
      startPlayerProgressTicker(queue, track, msg);
    } catch (err) {
      logger.error({ err }, '[MUSIC] Error broadcasting playerStart event');
    }
  });

  player.events.on('playerFinish', (queue: GuildQueue<any>) => {
    stopPlayerProgressTicker(queue);
    if (queue.metadata?.lastPlayerMessage) {
      try {
        const oldMsg = queue.metadata.lastPlayerMessage as Message;
        oldMsg.edit({ components: [] }).catch(() => {});
      } catch {}
    }
  });

  player.events.on('disconnect', (queue: GuildQueue<any>) => {
    stopPlayerProgressTicker(queue);
  });

  player.events.on('emptyChannel', async (queue: GuildQueue<any>) => {
    stopPlayerProgressTicker(queue);
    try {
      const channel = queue.metadata?.channel as any;
      if (channel && typeof channel.send === 'function') {
        const embed = new EmbedBuilder()
          .setColor(0xf59e0b)
          .setTitle('👋 Voice Channel Vacated')
          .setDescription('Everyone has left the voice channel. Stopping playback and disconnecting to save bandwidth.')
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err }, '[MUSIC] Error handling emptyChannel event');
    }
  });

  player.events.on('emptyQueue', async (queue: GuildQueue<any>) => {
    stopPlayerProgressTicker(queue);
    // Only broadcast if playback has truly finished and no track is actively playing
    if (queue.isPlaying() || queue.currentTrack) return;
    try {
      const channel = queue.metadata?.channel as any;
      if (channel && typeof channel.send === 'function') {
        const embed = new EmbedBuilder()
          .setColor(0x10b981)
          .setTitle('✅ Queue Concluded')
          .setDescription('All tracks in the queue have finished playing. Use `/play` to add more music!')
          .setTimestamp();
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (err) {
      logger.error({ err }, '[MUSIC] Error handling emptyQueue event');
    }
  });

  player.events.on('error', (queue: GuildQueue<any>, error: Error) => {
    stopPlayerProgressTicker(queue);
    logger.error({ err: error, guildId: queue.guild.id }, '[MUSIC] General queue error');
  });

  player.events.on('playerError', (queue: GuildQueue<any>, error: Error) => {
    stopPlayerProgressTicker(queue);
    logger.error({ err: error, guildId: queue.guild.id }, '[MUSIC] Player stream audio error');
    const channel = queue.metadata?.channel as any;
    if (channel && typeof channel.send === 'function') {
      channel.send({
        content: `⚠️ **Playback Error:** Unable to stream audio track (${error.message || 'Unknown stream issue'}). Skipping to next track...`,
      }).catch(() => {});
    }
  });

  musicPlayer = player;
  logger.info('[MUSIC] Discord Player initialized with full multi-source extractors.');
  return player;
}

export async function playTrack(
  member: GuildMember,
  voiceChannel: VoiceBasedChannel,
  textChannel: TextBasedChannel,
  query: string
): Promise<{
  success: boolean;
  track?: Track;
  playlistTitle?: string;
  playlistTracksCount?: number;
  position?: number;
  queueSize: number;
  isStartingImmediately: boolean;
  message: string;
}> {
  const player = getMusicPlayer();
  const settings = await getMusicSettings(member.guild.id);

  if (!settings.enabled) {
    return {
      success: false,
      queueSize: 0,
      isStartingImmediately: false,
      message: '❌ Music system is currently disabled in this server.',
    };
  }

  // Verify voice permissions
  const permissions = voiceChannel.permissionsFor(member.guild.members.me || member.client.user.id);
  if (!permissions?.has(PermissionFlagsBits.Connect)) {
    return {
      success: false,
      queueSize: 0,
      isStartingImmediately: false,
      message: `❌ SRB NEXUS lacks **Connect** permission in <#${voiceChannel.id}>.`,
    };
  }
  if (!permissions?.has(PermissionFlagsBits.Speak)) {
    return {
      success: false,
      queueSize: 0,
      isStartingImmediately: false,
      message: `❌ SRB NEXUS lacks **Speak** permission in <#${voiceChannel.id}>.`,
    };
  }

  // Detect if query is an explicit URL (Spotify, SoundCloud, YouTube, direct link) or search keywords
  const isUrl = /^https?:\/\//i.test(query.trim());
  const searchEngine = isUrl ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH;

  // Pre-search to check results and queue capacity
  let searchResult: SearchResult = await player.search(query, {
    requestedBy: member.user,
    searchEngine,
  });

  if (!searchResult.hasTracks() && !isUrl) {
    // Fallback to auto search if YouTube search had no match
    searchResult = await player.search(query, {
      requestedBy: member.user,
      searchEngine: QueryType.AUTO,
    });
  }

  if (!searchResult.hasTracks()) {
    return {
      success: false,
      queueSize: 0,
      isStartingImmediately: false,
      message: `❌ No results or streamable audio found for: \`${query}\``,
    };
  }

  // Existing queue check
  const existingQueue = player.nodes.get(member.guild.id);
  const wasPlaying = existingQueue && (existingQueue.isPlaying() || !!existingQueue.currentTrack);
  const currentSize = existingQueue ? existingQueue.tracks.size : 0;
  const incomingCount = searchResult.playlist ? searchResult.tracks.length : 1;

  if (currentSize + incomingCount > settings.max_queue_length) {
    return {
      success: false,
      queueSize: currentSize,
      isStartingImmediately: false,
      message: `❌ Adding this would exceed the maximum server queue limit of **${settings.max_queue_length}** songs (Current: ${currentSize}).`,
    };
  }

  // Play or enqueue via player.play with robust ffmpeg transcoding
  try {
    const playResult = await player.play(voiceChannel, searchResult, {
      nodeOptions: {
        metadata: {
          channel: textChannel,
          requestedBy: member.user,
          lastPlayerMessage: null,
          suppressPlayerStartMessage: false,
        },
        volume: settings.default_volume,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300_000,
        leaveOnEnd: true,
        leaveOnEndCooldown: 300_000,
        selfDeaf: true,
        maxSize: settings.max_queue_length,
        skipFFmpeg: false,
        bufferingTimeout: 10_000,
      } as any,
      requestedBy: member.user,
    });

    const isPlaylist = !!searchResult.playlist;
    const addedTrack = playResult.track;
    const finalQueue = playResult.queue;
    const isStartingImmediately = !wasPlaying;

    return {
      success: true,
      track: addedTrack,
      playlistTitle: isPlaylist ? searchResult.playlist?.title : undefined,
      playlistTracksCount: isPlaylist ? searchResult.tracks.length : undefined,
      position: finalQueue.tracks.size,
      queueSize: finalQueue.tracks.size,
      isStartingImmediately,
      message: isPlaylist
        ? `✅ Enqueued playlist **${searchResult.playlist?.title}** (${searchResult.tracks.length} tracks).`
        : `✅ Added **[${addedTrack.title}](${addedTrack.url})** (\`${addedTrack.duration}\`) to queue.`,
    };
  } catch (err: any) {
    logger.error({ err, query, guildId: member.guild.id }, '[MUSIC] Error in playTrack');
    return {
      success: false,
      queueSize: 0,
      isStartingImmediately: false,
      message: `❌ Failed to initiate audio playback: ${err?.message || 'Unknown playback error'}`,
    };
  }
}

export async function skipTrack(member: GuildMember): Promise<{
  success: boolean;
  skippedTrack?: string;
  nextTrack?: string;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue || !queue.isPlaying()) {
    return { success: false, message: '❌ There is no active music playback to skip.' };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return { success: false, message: perm.reason || '❌ You lack permission to skip songs.' };
  }

  const currentTrackTitle = queue.currentTrack?.title || 'Unknown Track';
  const nextTrackTitle = queue.tracks.at(0)?.title;

  stopPlayerProgressTicker(queue);
  queue.node.skip();

  return {
    success: true,
    skippedTrack: currentTrackTitle,
    nextTrack: nextTrackTitle,
    message: nextTrackTitle
      ? `⏭️ Skipped **${currentTrackTitle}**! Up next: **${nextTrackTitle}**.`
      : `⏭️ Skipped **${currentTrackTitle}**! End of queue reached.`,
  };
}

export async function pauseResumeTrack(member: GuildMember): Promise<{
  success: boolean;
  isPaused: boolean;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue || !queue.currentTrack) {
    return { success: false, isPaused: false, message: '❌ There is no active music stream to pause/resume.' };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return { success: false, isPaused: false, message: perm.reason || '❌ You lack permission to pause/resume.' };
  }

  const currentlyPaused = queue.node.isPaused();
  const newPausedState = !currentlyPaused;
  queue.node.setPaused(newPausedState);

  // Update existing card if available
  if (queue.metadata?.lastPlayerMessage && queue.currentTrack) {
    const msg = queue.metadata.lastPlayerMessage as Message;
    const embed = buildNowPlayingEmbed(queue, queue.currentTrack);
    const row = buildMusicControlRow(newPausedState, queue.repeatMode);
    msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  }

  return {
    success: true,
    isPaused: newPausedState,
    message: newPausedState ? '⏸️ Music playback **paused**.' : '▶️ Music playback **resumed**.',
  };
}

export async function stopPlayback(member: GuildMember): Promise<{
  success: boolean;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue) {
    return { success: false, message: '❌ There is no active music session in this server.' };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return { success: false, message: perm.reason || '❌ You lack permission to stop playback.' };
  }

  stopPlayerProgressTicker(queue);

  if (queue.metadata?.lastPlayerMessage) {
    const msg = queue.metadata.lastPlayerMessage as Message;
    msg.edit({ components: [] }).catch(() => {});
  }

  queue.delete();

  return {
    success: true,
    message: '⏹️ Playback stopped, queue cleared, and audio connection closed.',
  };
}

export async function setVolume(
  member: GuildMember,
  volume: number
): Promise<{
  success: boolean;
  volume: number;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue) {
    return { success: false, volume: 80, message: '❌ No active music playback found.' };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return { success: false, volume: queue.node.volume, message: perm.reason || '❌ You lack permission to adjust volume.' };
  }

  const safeVol = Math.max(1, Math.min(100, Math.round(volume)));
  queue.node.setVolume(safeVol);

  // Update existing card if available
  if (queue.metadata?.lastPlayerMessage && queue.currentTrack) {
    const msg = queue.metadata.lastPlayerMessage as Message;
    const embed = buildNowPlayingEmbed(queue, queue.currentTrack);
    const row = buildMusicControlRow(queue.node.isPaused(), queue.repeatMode);
    msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  }

  return {
    success: true,
    volume: safeVol,
    message: `🔊 Volume set to **${safeVol}%**.`,
  };
}

export async function toggleLoopMode(
  member: GuildMember,
  explicitMode?: QueueRepeatMode
): Promise<{
  success: boolean;
  mode: QueueRepeatMode;
  modeLabel: string;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue) {
    return {
      success: false,
      mode: QueueRepeatMode.OFF,
      modeLabel: 'Off',
      message: '❌ No active music playback found.',
    };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return {
      success: false,
      mode: queue.repeatMode,
      modeLabel: getRepeatModeLabel(queue.repeatMode),
      message: perm.reason || '❌ You lack permission to modify loop mode.',
    };
  }

  let nextMode: QueueRepeatMode;
  if (explicitMode !== undefined) {
    nextMode = explicitMode;
  } else {
    // Cycle: OFF -> TRACK -> QUEUE -> AUTOPLAY -> OFF
    if (queue.repeatMode === QueueRepeatMode.OFF) {
      nextMode = QueueRepeatMode.TRACK;
    } else if (queue.repeatMode === QueueRepeatMode.TRACK) {
      nextMode = QueueRepeatMode.QUEUE;
    } else if (queue.repeatMode === QueueRepeatMode.QUEUE) {
      nextMode = QueueRepeatMode.AUTOPLAY;
    } else {
      nextMode = QueueRepeatMode.OFF;
    }
  }

  queue.setRepeatMode(nextMode);
  const label = getRepeatModeLabel(nextMode);

  // Update existing player message
  if (queue.metadata?.lastPlayerMessage && queue.currentTrack) {
    const msg = queue.metadata.lastPlayerMessage as Message;
    const embed = buildNowPlayingEmbed(queue, queue.currentTrack);
    const row = buildMusicControlRow(queue.node.isPaused(), nextMode);
    msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  }

  return {
    success: true,
    mode: nextMode,
    modeLabel: label,
    message: `🔁 Loop mode updated to **${label}**.`,
  };
}

export async function shuffleQueue(member: GuildMember): Promise<{
  success: boolean;
  trackCount: number;
  message: string;
}> {
  const player = getMusicPlayer();
  const queue = player.nodes.get(member.guild.id);

  if (!queue || queue.tracks.size < 2) {
    return {
      success: false,
      trackCount: queue ? queue.tracks.size : 0,
      message: '❌ There must be at least 2 tracks in the queue to shuffle.',
    };
  }

  const perm = await canControlPlayback(member, queue);
  if (!perm.allowed) {
    return {
      success: false,
      trackCount: queue.tracks.size,
      message: perm.reason || '❌ You lack permission to shuffle the queue.',
    };
  }

  queue.tracks.shuffle();

  return {
    success: true,
    trackCount: queue.tracks.size,
    message: `🔀 Successfully shuffled **${queue.tracks.size}** songs in the queue!`,
  };
}

export function getNowPlayingData(guildId: string): {
  embed: EmbedBuilder;
  row: ActionRowBuilder<ButtonBuilder>;
} | null {
  const player = getMusicPlayer();
  const queue = player.nodes.get(guildId);

  if (!queue || !queue.currentTrack) {
    return null;
  }

  const embed = buildNowPlayingEmbed(queue, queue.currentTrack);
  const row = buildMusicControlRow(queue.node.isPaused(), queue.repeatMode);

  return { embed, row };
}

export function getQueueEmbed(guildId: string, page: number = 1): EmbedBuilder | null {
  const player = getMusicPlayer();
  const queue = player.nodes.get(guildId);

  if (!queue || (!queue.currentTrack && queue.tracks.size === 0)) {
    return null;
  }

  const tracks = queue.tracks.toArray();
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));

  const startIdx = (currentPage - 1) * pageSize;
  const pageTracks = tracks.slice(startIdx, startIdx + pageSize);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`📑 Music Queue — ${queue.guild.name}`)
    .setFooter({
      text: `Page ${currentPage}/${totalPages} • ${tracks.length} tracks in queue • Loop: ${getRepeatModeLabel(queue.repeatMode)}`,
    })
    .setTimestamp();

  if (queue.currentTrack) {
    const cur = queue.currentTrack;
    const bar = queue.node.createProgressBar({ length: 12, timecodes: true }) || `\`[${cur.duration}]\``;
    embed.setDescription(
      `**Now Playing:**\n` +
      `🎵 [**${cur.title}**](${cur.url}) • \`${cur.duration}\`\n` +
      `Requested by: <@${cur.requestedBy?.id || 'Unknown'}>\n` +
      `${bar}\n\n` +
      `__**Upcoming Tracks:**__`
    );
  }

  if (pageTracks.length === 0) {
    embed.addFields({
      name: 'Queue is Empty',
      value: 'No further songs queued up. Use `/play` or `!play` to add more!',
    });
  } else {
    const trackListStr = pageTracks
      .map((t, idx) => {
        const num = startIdx + idx + 1;
        const title = t.title.length > 55 ? t.title.slice(0, 52) + '...' : t.title;
        return `\`${num}.\` [**${title}**](${t.url}) (\`${t.duration}\`) — <@${t.requestedBy?.id || 'Unknown'}>`;
      })
      .join('\n');

    embed.addFields({
      name: `Tracks (Page ${currentPage} of ${totalPages})`,
      value: trackListStr,
    });
  }

  return embed;
}
