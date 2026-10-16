import {
  Client,
  Message,
  EmbedBuilder,
  TextChannel,
  ThreadChannel,
  User,
  Guild,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { db } from '../core/database';
import { logger } from '../core/logger';

/**
 * Handle incoming direct messages (DMs) from community members
 */
export async function handleModmailDM(client: Client, message: Message): Promise<void> {
  if (message.author.bot || !message.channel.isDMBased()) return;

  const user = message.author;

  try {
    // 1. Find mutual guilds where modmail is enabled
    const mutualGuilds: Guild[] = [];
    for (const [, guild] of client.guilds.cache) {
      const isMember = await guild.members.fetch(user.id).catch(() => null);
      if (isMember) {
        mutualGuilds.push(guild);
      }
    }

    if (mutualGuilds.length === 0) {
      await message.reply('⚠️ You do not share any servers with SRB NEXUS.');
      return;
    }

    // 2. Query guild_settings for modmail configuration
    const guildIds = mutualGuilds.map((g) => g.id);
    const res = await db.query(
      `SELECT guild_id, modmail_enabled, modmail_channel_id, modmail_role_id 
       FROM guild_settings 
       WHERE guild_id = ANY($1) AND modmail_enabled = TRUE`,
      [guildIds]
    );

    if (res.rows.length === 0) {
      await message.reply(
        'ℹ️ Direct support is currently not configured on your servers. Please check the server rules or open a ticket in the server.'
      );
      return;
    }

    // Target the first configured guild
    const targetConfig = res.rows[0];
    const targetGuild = mutualGuilds.find((g) => g.id === targetConfig.guild_id);
    if (!targetGuild) return;

    const channel = targetGuild.channels.cache.get(targetConfig.modmail_channel_id) as TextChannel | null;
    if (!channel || !channel.isTextBased()) {
      await message.reply('⚠️ Staff support channel is currently unreachable. Please notify an administrator.');
      return;
    }

    // 3. Dispatch modmail embed to the staff channel
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({
        name: `📬 Modmail from ${user.tag}`,
        iconURL: user.displayAvatarURL(),
      })
      .setDescription(message.content || '*(No text content)*')
      .addFields(
        { name: '👤 User ID', value: `\`${user.id}\``, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '💬 Reply Instructions', value: `Use \`/modmail reply user:@${user.username} message:<text>\``, inline: false }
      )
      .setFooter({ text: `Target: ${targetGuild.name}` })
      .setTimestamp();

    // Attachments if any
    const attachments = message.attachments.map((a) => a.url);
    if (attachments.length > 0) {
      embed.addFields({ name: '📎 Attachments', value: attachments.join('\n') });
    }

    await channel.send({
      content: targetConfig.modmail_role_id ? `<@&${targetConfig.modmail_role_id}>` : undefined,
      embeds: [embed],
    });

    // 4. Confirm delivery to user
    await message.react('✅').catch(() => {});
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#10b981')
          .setTitle('📨 Message Delivered to Staff')
          .setDescription(
            `Your message has been securely forwarded to the **${targetGuild.name}** moderation team.\n\nPlease hold on while a staff member reviews your inquiry.`
          )
          .setTimestamp(),
      ],
    });

    logger.info(`[MODMAIL] Forwarded DM from ${user.tag} (${user.id}) to ${targetGuild.name}`);
  } catch (err: any) {
    logger.error({ err }, `[MODMAIL] Failed processing DM from ${user.tag}`);
    await message.reply('❌ An error occurred transmitting your message to server staff.').catch(() => {});
  }
}

/**
 * Send an outbound reply from staff directly to the user's private DMs
 */
export async function sendStaffModmailReply(
  client: Client,
  targetUserId: string,
  staffUser: User,
  guildName: string,
  replyText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const targetUser = await client.users.fetch(targetUserId).catch(() => null);
    if (!targetUser) return { success: false, error: 'Target user not found or has blocked bot' };

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setAuthor({
        name: `🛡️ Staff Response from ${guildName}`,
        iconURL: staffUser.displayAvatarURL(),
      })
      .setDescription(replyText)
      .setFooter({ text: `Replied by staff member • Today` })
      .setTimestamp();

    await targetUser.send({ embeds: [embed] });
    logger.info(`[MODMAIL] Staff ${staffUser.tag} sent reply to user ${targetUser.tag}`);
    return { success: true };
  } catch (err: any) {
    logger.error({ err }, `[MODMAIL] Failed sending DM reply to ${targetUserId}`);
    return { success: false, error: 'User has DMs disabled or is unreachable.' };
  }
}
