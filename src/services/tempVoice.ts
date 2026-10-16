import {
  VoiceState,
  ChannelType,
  PermissionFlagsBits,
  VoiceChannel,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

// Set of active temporary voice channel IDs currently managed by the bot
export const activeTempVoiceChannels = new Set<string>();

/**
 * Handle VoiceStateUpdate event for Join-to-Create Temporary Voice Rooms
 */
export async function handleTempVoiceStateUpdate(
  oldState: VoiceState,
  newState: VoiceState
): Promise<void> {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const member = newState.member || oldState.member;
  if (!member || member.user.bot) return;

  try {
    // 1. Check if user just joined the master "Join to Create" channel
    if (newState.channelId && newState.channelId !== oldState.channelId) {
      const res = await db.query(
        `SELECT temp_voice_enabled, temp_voice_master_id, temp_voice_category_id, temp_voice_name_template 
         FROM guild_settings WHERE guild_id = $1`,
        [guild.id]
      );

      if (res.rows.length > 0 && res.rows[0].temp_voice_enabled) {
        const {
          temp_voice_master_id,
          temp_voice_category_id,
          temp_voice_name_template,
        } = res.rows[0];

        if (temp_voice_master_id && newState.channelId === temp_voice_master_id) {
          // User joined the master channel -> Generate a fresh private voice channel
          const template = temp_voice_name_template || "🔊 {username}'s Room";
          const channelName = template.replace('{username}', member.displayName || member.user.username);

          const tempChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: temp_voice_category_id || undefined,
            permissionOverwrites: [
              {
                id: guild.roles.everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
              },
              {
                id: member.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.MuteMembers,
                  PermissionFlagsBits.DeafenMembers,
                  PermissionFlagsBits.MoveMembers,
                ],
              },
            ],
          });

          activeTempVoiceChannels.add(tempChannel.id);
          logger.info(`[TEMP VOICE] Created temporary voice channel '${channelName}' for ${member.user.tag}`);

          // Move user into their newly created room
          await member.voice.setChannel(tempChannel).catch((err) => {
            logger.warn({ err }, `[TEMP VOICE] Failed to move ${member.user.tag} into temp room`);
          });
          return;
        }
      }
    }

    // 2. Check if a user left a voice channel, and if that channel was a temp room now empty
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      if (activeTempVoiceChannels.has(oldState.channelId)) {
        const channel = oldState.channel as VoiceChannel | null;
        if (channel && channel.members.size === 0) {
          activeTempVoiceChannels.delete(oldState.channelId);
          await channel.delete('Temporary voice room empty').catch((err) => {
            logger.warn({ err }, `[TEMP VOICE] Failed deleting empty temp room ${oldState.channelId}`);
          });
          logger.info(`[TEMP VOICE] Deleted empty temporary voice channel: ${channel.name}`);
        }
      }
    }
  } catch (err: any) {
    logger.error({ err }, `[TEMP VOICE] Error processing voiceStateUpdate in guild ${guild.name}`);
  }
}
