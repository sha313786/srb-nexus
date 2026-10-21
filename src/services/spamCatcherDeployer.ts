import {
  Client,
  ChannelType,
  EmbedBuilder,
  TextChannel,
  PermissionFlagsBits,
} from 'discord.js';
import { db } from '../core/database';
import { invalidateSpamCatcherCache } from '../security/antiSpam';
import { logger } from '../core/logger';

export interface DeploySpamCatcherOptions {
  guildId: string;
  channelId?: string | null;
  timeoutHours?: number;
  action?: 'TIMEOUT' | 'KICK' | 'BAN' | 'DELETE';
  customTitle?: string;
  customDesc?: string;
}

export async function deploySpamCatcherHoneypot(
  client: Client,
  options: DeploySpamCatcherOptions
): Promise<{ success: boolean; channelId?: string; messageId?: string; error?: string }> {
  try {
    const guild =
      client.guilds.cache.get(options.guildId) ||
      (await client.guilds.fetch(options.guildId).catch(() => null));
    if (!guild) return { success: false, error: 'Guild not found' };

    let targetChannel: TextChannel | null = null;

    // 1. If channelId provided, fetch it
    if (options.channelId && options.channelId !== 'auto') {
      const fetched =
        guild.channels.cache.get(options.channelId) ||
        (await guild.channels.fetch(options.channelId).catch(() => null));
      if (fetched && fetched instanceof TextChannel) {
        targetChannel = fetched;
      }
    }

    // 2. If no channel provided or found, locate or auto-create `# 🐝 ꜛ SPAM-CATCHER`
    if (!targetChannel) {
      const existing = guild.channels.cache.find(
        (c) =>
          c instanceof TextChannel &&
          (c.name.includes('spam-catcher') ||
            c.name.includes('spam_catcher') ||
            c.name.includes('spamcatcher'))
      );
      if (existing && existing instanceof TextChannel) {
        targetChannel = existing;
      } else {
        const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          return {
            success: false,
            error: 'Bot lacks ManageChannels permission to create a spam catcher channel.',
          };
        }

        // Try to place under an info or system category if available
        const category = guild.channels.cache.find(
          (c) => c.type === ChannelType.GuildCategory && /info|welcome|system|rules|guide/i.test(c.name)
        );

        targetChannel = await guild.channels.create({
          name: '🐝-spam-catcher',
          type: ChannelType.GuildText,
          parent: category?.id,
          topic: 'Automated Honey-Pot Decoy: Catches and neutralizes spam bots in real-time.',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ],
        });
      }
    }

    const timeoutHours = Math.max(1, Math.min(720, options.timeoutHours || 6));
    const action = options.action || 'TIMEOUT';
    const timeoutSeconds = timeoutHours * 3600;

    let durationText = `${timeoutHours} Hours timeout`;
    if (action === 'KICK') durationText = 'instant Kick';
    else if (action === 'BAN') durationText = 'permanent Ban';
    else if (action === 'DELETE') durationText = 'message deletion';

    const embedTitle = options.customTitle || 'DO NOT SEND MESSAGES IN THIS CHANNEL 🚨';
    const embedDesc =
      options.customDesc ||
      `This channel is used to catch spam bots. Any messages sent here will result in a **${durationText}**.`;

    const botAvatar = client.user?.displayAvatarURL({ size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

    const embed = new EmbedBuilder()
      .setTitle(embedTitle)
      .setDescription(embedDesc)
      .setColor(0x00f0ff)
      .setThumbnail(botAvatar)
      .setFooter({ text: 'SRB NEXUS Sovereign Spam Defense' })
      .setTimestamp();

    const deployedMsg = await targetChannel.send({ embeds: [embed] });

    // 3. Save into database
    await db.query(
      `INSERT INTO guild_spam_catcher (
        guild_id, enabled, honeypot_channel_id, action, timeout_duration_seconds, updated_at
      ) VALUES ($1, TRUE, $2, $3, $4, NOW())
      ON CONFLICT (guild_id) DO UPDATE SET
        enabled = TRUE,
        honeypot_channel_id = $2,
        action = $3,
        timeout_duration_seconds = $4,
        updated_at = NOW()`,
      [guild.id, targetChannel.id, action, timeoutSeconds]
    );

    invalidateSpamCatcherCache(guild.id);

    return {
      success: true,
      channelId: targetChannel.id,
      messageId: deployedMsg.id,
    };
  } catch (err: any) {
    logger.error({ err }, '[SPAM CATCHER] Failed to deploy honeypot trap');
    return { success: false, error: err.message || String(err) };
  }
}
