import {
  Guild,
  GuildMember,
  ChannelType,
  PermissionFlagsBits,
  VoiceBasedChannel,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

export interface VoiceRoomMemberInfo {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  isMuted: boolean;
  isServerMuted: boolean;
  isDeafened: boolean;
  isBot: boolean;
}

export interface VoiceRoomInfo {
  id: string;
  name: string;
  position: number;
  userLimit: number;
  memberCount: number;
  members: VoiceRoomMemberInfo[];
}

export interface VoiceActionModerator {
  id: string;
  tag: string;
}

export interface VoiceMuteOptions {
  channelId?: string | 'ALL';
  moderator: VoiceActionModerator;
  reason?: string;
  excludeSelf?: boolean;
  excludeBots?: boolean;
}

export interface VoiceUnmuteOptions {
  channelId?: string | 'ALL';
  moderator: VoiceActionModerator;
  reason?: string;
}

export interface VoiceMoveOptions {
  targetChannelId: string;
  sourceChannelId?: string | 'ALL';
  moderator: VoiceActionModerator;
  reason?: string;
}

export interface VoiceActionResult {
  success: boolean;
  affected: number;
  skipped: number;
  failed: number;
  channelName: string;
  targetChannelName?: string;
  message: string;
}

/**
 * Returns a list of all voice channels in a guild along with connected members.
 */
export async function getVoiceRooms(guild: Guild): Promise<VoiceRoomInfo[]> {
  const rooms: VoiceRoomInfo[] = [];

  const voiceChannels = guild.channels.cache.filter(
    (c): c is VoiceBasedChannel =>
      c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice
  );

  for (const [, channel] of voiceChannels) {
    const membersList: VoiceRoomMemberInfo[] = [];

    for (const [, member] of channel.members) {
      membersList.push({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL({ size: 64 }),
        isMuted: !!(member.voice.serverMute || member.voice.selfMute),
        isServerMuted: !!member.voice.serverMute,
        isDeafened: !!(member.voice.serverDeaf || member.voice.selfDeaf),
        isBot: member.user.bot,
      });
    }

    rooms.push({
      id: channel.id,
      name: channel.name,
      position: channel.position,
      userLimit: channel.userLimit || 0,
      memberCount: channel.members.size,
      members: membersList,
    });
  }

  rooms.sort((a, b) => a.position - b.position);
  return rooms;
}

/**
 * Mute all members in a specified voice channel or across all voice channels in the guild.
 */
export async function muteAllVoice(
  guild: Guild,
  opts: VoiceMuteOptions
): Promise<VoiceActionResult> {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
    return {
      success: false,
      affected: 0,
      skipped: 0,
      failed: 0,
      channelName: '',
      message: 'Nexus lacks the "Mute Members" permission in this server.',
    };
  }

  const reason = opts.reason || `[NEXUS VOICE] Mass mute executed by ${opts.moderator.tag}`;
  const excludeSelf = opts.excludeSelf !== false; // default true
  const excludeBots = opts.excludeBots !== false; // default true

  // 1. Resolve target channel(s)
  let targetChannels: VoiceBasedChannel[] = [];
  let channelDisplayName = '';

  if (opts.channelId && opts.channelId !== 'ALL') {
    const chan = guild.channels.cache.get(opts.channelId) || (await guild.channels.fetch(opts.channelId).catch(() => null));
    if (!chan || (chan.type !== ChannelType.GuildVoice && chan.type !== ChannelType.GuildStageVoice)) {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: '',
        message: 'Invalid voice channel specified.',
      };
    }
    targetChannels = [chan as VoiceBasedChannel];
    channelDisplayName = chan.name;
  } else if (opts.channelId === 'ALL') {
    targetChannels = Array.from(
      guild.channels.cache
        .filter((c): c is VoiceBasedChannel => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
        .values()
    );
    channelDisplayName = 'All Voice Channels';
  } else {
    // If not specified, look for moderator's active voice channel
    const modMember = guild.members.cache.get(opts.moderator.id) || (await guild.members.fetch(opts.moderator.id).catch(() => null));
    if (modMember?.voice?.channel) {
      targetChannels = [modMember.voice.channel];
      channelDisplayName = modMember.voice.channel.name;
    } else {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: '',
        message: 'You are not in a voice channel. Please specify a voice channel or join one first.',
      };
    }
  }

  // 2. Collect members
  const membersToMute: GuildMember[] = [];
  let skippedCount = 0;

  for (const chan of targetChannels) {
    for (const [, member] of chan.members) {
      if (excludeBots && member.user.bot) {
        skippedCount++;
        continue;
      }
      if (excludeSelf && member.id === opts.moderator.id) {
        skippedCount++;
        continue;
      }
      if (member.voice.serverMute) {
        skippedCount++;
        continue;
      }
      membersToMute.push(member);
    }
  }

  if (membersToMute.length === 0) {
    return {
      success: true,
      affected: 0,
      skipped: skippedCount,
      failed: 0,
      channelName: channelDisplayName,
      message: `No eligible members to mute in **${channelDisplayName}** (${skippedCount} skipped/already muted).`,
    };
  }

  // 3. Execute muting in parallel
  const results = await Promise.allSettled(
    membersToMute.map((m) => m.voice.setMute(true, reason))
  );

  let affectedCount = 0;
  let failedCount = 0;

  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      affectedCount++;
    } else {
      failedCount++;
      logger.warn({ err: res.reason }, '[VOICE] Failed to server-mute member');
    }
  });

  // 4. Log to database & audit log
  await recordVoiceModAction(guild, {
    action: 'VOICE_MUTE_ALL',
    moderator: opts.moderator,
    channelName: channelDisplayName,
    affectedCount,
    reason,
  });

  return {
    success: true,
    affected: affectedCount,
    skipped: skippedCount,
    failed: failedCount,
    channelName: channelDisplayName,
    message: `🔇 Successfully muted **${affectedCount}** members in **${channelDisplayName}**${
      skippedCount > 0 ? ` (${skippedCount} skipped)` : ''
    }${failedCount > 0 ? ` (${failedCount} failed due to role hierarchy)` : ''}.`,
  };
}

/**
 * Unmute all members in a voice channel or across the guild.
 */
export async function unmuteAllVoice(
  guild: Guild,
  opts: VoiceUnmuteOptions
): Promise<VoiceActionResult> {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
    return {
      success: false,
      affected: 0,
      skipped: 0,
      failed: 0,
      channelName: '',
      message: 'Nexus lacks the "Mute Members" permission in this server.',
    };
  }

  const reason = opts.reason || `[NEXUS VOICE] Mass unmute executed by ${opts.moderator.tag}`;

  // 1. Resolve target channel(s)
  let targetChannels: VoiceBasedChannel[] = [];
  let channelDisplayName = '';

  if (opts.channelId && opts.channelId !== 'ALL') {
    const chan = guild.channels.cache.get(opts.channelId) || (await guild.channels.fetch(opts.channelId).catch(() => null));
    if (!chan || (chan.type !== ChannelType.GuildVoice && chan.type !== ChannelType.GuildStageVoice)) {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: '',
        message: 'Invalid voice channel specified.',
      };
    }
    targetChannels = [chan as VoiceBasedChannel];
    channelDisplayName = chan.name;
  } else if (opts.channelId === 'ALL') {
    targetChannels = Array.from(
      guild.channels.cache
        .filter((c): c is VoiceBasedChannel => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice)
        .values()
    );
    channelDisplayName = 'All Voice Channels';
  } else {
    const modMember = guild.members.cache.get(opts.moderator.id) || (await guild.members.fetch(opts.moderator.id).catch(() => null));
    if (modMember?.voice?.channel) {
      targetChannels = [modMember.voice.channel];
      channelDisplayName = modMember.voice.channel.name;
    } else {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: '',
        message: 'You are not in a voice channel. Please specify a voice channel or join one first.',
      };
    }
  }

  // 2. Collect members currently server-muted
  const membersToUnmute: GuildMember[] = [];
  let skippedCount = 0;

  for (const chan of targetChannels) {
    for (const [, member] of chan.members) {
      if (member.voice.serverMute) {
        membersToUnmute.push(member);
      } else {
        skippedCount++;
      }
    }
  }

  if (membersToUnmute.length === 0) {
    return {
      success: true,
      affected: 0,
      skipped: skippedCount,
      failed: 0,
      channelName: channelDisplayName,
      message: `No server-muted members found in **${channelDisplayName}**.`,
    };
  }

  // 3. Execute unmuting in parallel
  const results = await Promise.allSettled(
    membersToUnmute.map((m) => m.voice.setMute(false, reason))
  );

  let affectedCount = 0;
  let failedCount = 0;

  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      affectedCount++;
    } else {
      failedCount++;
      logger.warn({ err: res.reason }, '[VOICE] Failed to server-unmute member');
    }
  });

  // 4. Log to database & audit log
  await recordVoiceModAction(guild, {
    action: 'VOICE_UNMUTE_ALL',
    moderator: opts.moderator,
    channelName: channelDisplayName,
    affectedCount,
    reason,
  });

  return {
    success: true,
    affected: affectedCount,
    skipped: skippedCount,
    failed: failedCount,
    channelName: channelDisplayName,
    message: `🔊 Successfully unmuted **${affectedCount}** members in **${channelDisplayName}**${
      failedCount > 0 ? ` (${failedCount} failed due to role hierarchy)` : ''
    }.`,
  };
}

/**
 * Move all members from a source channel (or all channels) to a target voice channel.
 */
export async function moveAllVoice(
  guild: Guild,
  opts: VoiceMoveOptions
): Promise<VoiceActionResult> {
  const botMember = guild.members.me;
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.MoveMembers)) {
    return {
      success: false,
      affected: 0,
      skipped: 0,
      failed: 0,
      channelName: '',
      message: 'Nexus lacks the "Move Members" permission in this server.',
    };
  }

  // 1. Resolve Target Channel
  const targetChannel = guild.channels.cache.get(opts.targetChannelId) ||
    (await guild.channels.fetch(opts.targetChannelId).catch(() => null));

  if (
    !targetChannel ||
    (targetChannel.type !== ChannelType.GuildVoice && targetChannel.type !== ChannelType.GuildStageVoice)
  ) {
    return {
      success: false,
      affected: 0,
      skipped: 0,
      failed: 0,
      channelName: '',
      message: 'Target channel is not a valid voice channel.',
    };
  }

  const reason = opts.reason || `[NEXUS VOICE] Mass move executed by ${opts.moderator.tag}`;

  // 2. Resolve Source Channel(s)
  let sourceChannels: VoiceBasedChannel[] = [];
  let sourceDisplayName = '';

  if (opts.sourceChannelId && opts.sourceChannelId !== 'ALL') {
    const src = guild.channels.cache.get(opts.sourceChannelId) ||
      (await guild.channels.fetch(opts.sourceChannelId).catch(() => null));
    if (!src || (src.type !== ChannelType.GuildVoice && src.type !== ChannelType.GuildStageVoice)) {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: '',
        message: 'Source channel is not a valid voice channel.',
      };
    }
    if (src.id === targetChannel.id) {
      return {
        success: false,
        affected: 0,
        skipped: 0,
        failed: 0,
        channelName: src.name,
        message: 'Source and target voice channels cannot be the same.',
      };
    }
    sourceChannels = [src as VoiceBasedChannel];
    sourceDisplayName = src.name;
  } else if (opts.sourceChannelId === 'ALL') {
    sourceChannels = Array.from(
      guild.channels.cache
        .filter(
          (c): c is VoiceBasedChannel =>
            (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) &&
            c.id !== targetChannel.id
        )
        .values()
    );
    sourceDisplayName = 'All Other Voice Channels';
  } else {
    // If not specified, check moderator's current voice channel
    const modMember = guild.members.cache.get(opts.moderator.id) ||
      (await guild.members.fetch(opts.moderator.id).catch(() => null));
    if (modMember?.voice?.channel && modMember.voice.channel.id !== targetChannel.id) {
      sourceChannels = [modMember.voice.channel];
      sourceDisplayName = modMember.voice.channel.name;
    } else {
      // Default to moving all connected members from all other channels into target
      sourceChannels = Array.from(
        guild.channels.cache
          .filter(
            (c): c is VoiceBasedChannel =>
              (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) &&
              c.id !== targetChannel.id
          )
          .values()
      );
      sourceDisplayName = 'All Connected Voice Rooms';
    }
  }

  // 3. Collect members to move
  const membersToMove: GuildMember[] = [];
  let skippedCount = 0;

  for (const chan of sourceChannels) {
    for (const [, member] of chan.members) {
      if (member.voice.channelId === targetChannel.id) {
        skippedCount++;
        continue;
      }
      membersToMove.push(member);
    }
  }

  if (membersToMove.length === 0) {
    return {
      success: true,
      affected: 0,
      skipped: skippedCount,
      failed: 0,
      channelName: sourceDisplayName,
      targetChannelName: targetChannel.name,
      message: `No members found in **${sourceDisplayName}** to move to **${targetChannel.name}**.`,
    };
  }

  // 4. Execute move in parallel
  const results = await Promise.allSettled(
    membersToMove.map((m) => m.voice.setChannel(targetChannel as VoiceBasedChannel, reason))
  );

  let affectedCount = 0;
  let failedCount = 0;

  results.forEach((res) => {
    if (res.status === 'fulfilled') {
      affectedCount++;
    } else {
      failedCount++;
      logger.warn({ err: res.reason }, '[VOICE] Failed to move member');
    }
  });

  // 5. Log to database & audit log
  await recordVoiceModAction(guild, {
    action: 'VOICE_MOVE_ALL',
    moderator: opts.moderator,
    channelName: `${sourceDisplayName} ➔ ${targetChannel.name}`,
    affectedCount,
    reason,
  });

  return {
    success: true,
    affected: affectedCount,
    skipped: skippedCount,
    failed: failedCount,
    channelName: sourceDisplayName,
    targetChannelName: targetChannel.name,
    message: `🔀 Successfully moved **${affectedCount}** members from **${sourceDisplayName}** into **${targetChannel.name}**${
      failedCount > 0 ? ` (${failedCount} failed to move)` : ''
    }.`,
  };
}

/**
 * Internal helper to record voice actions in moderation_logs and dispatch an embed to the guild's log channel.
 */
async function recordVoiceModAction(
  guild: Guild,
  info: {
    action: string;
    moderator: VoiceActionModerator;
    channelName: string;
    affectedCount: number;
    reason: string;
  }
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO moderation_logs (guild_id, target_user_id, moderator_user_id, action, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        guild.id,
        info.channelName.slice(0, 32),
        info.moderator.id,
        info.action.slice(0, 32),
        `[${info.affectedCount} members] ${info.reason}`,
      ]
    );
  } catch (err) {
    logger.error({ err }, '[VOICE] Failed to record voice mod action to DB');
  }

  try {
    const { rows } = await db.query(
      `SELECT COALESCE(
        (SELECT logging_channel_id FROM guild_security_config WHERE guild_id = $1),
        (SELECT log_channel_id FROM guild_settings WHERE guild_id = $1)
       ) AS logging_channel_id`,
      [guild.id]
    ).catch(() => ({ rows: [] }));

    const logChannelId = rows[0]?.logging_channel_id;
    if (!logChannelId) return;

    const logChan = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!logChan || !(logChan instanceof TextChannel)) return;

    const embed = new EmbedBuilder()
      .setTitle(`🔊 [VOICE MODERATION] ${info.action.replace(/_/g, ' ')}`)
      .setColor(info.action.includes('MUTE') ? 0xef4444 : info.action.includes('UNMUTE') ? 0x10b981 : 0x6366f1)
      .addFields(
        { name: 'Target Channel(s)', value: `\`${info.channelName}\``, inline: true },
        { name: 'Moderator', value: `<@${info.moderator.id}> (${info.moderator.tag})`, inline: true },
        { name: 'Members Affected', value: `**${info.affectedCount}** members`, inline: true },
        { name: 'Reason', value: info.reason, inline: false }
      )
      .setTimestamp();

    await logChan.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    logger.error({ err }, '[VOICE] Failed to send voice mod embed');
  }
}
